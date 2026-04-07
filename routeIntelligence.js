const axios = require('axios');

/**
 * Route Intelligence Services — Integrated into the Auction System
 * Uses Real APIs: Google Maps (fallback OSRM), Open-Meteo, and async structures.
 */

// ═══════════════════════════════════════════════
// Block 2: Distance Calculation (Google Maps API / OSRM)
// ═══════════════════════════════════════════════
async function getCoordinates(city) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`;
    const res = await axios.get(url, { headers: { 'User-Agent': 'OnlineAuctionSystem/1.0' } });
    if (res.data && res.data.length > 0) {
      return { lat: res.data[0].lat, lon: res.data[0].lon };
    }
  } catch (error) {
    console.error(`Geocoding error for ${city}:`, error.message);
  }
  return null;
}

async function calculateDistance(fromCity, toCity) {
  const fromNormalized = fromCity.toLowerCase().trim();
  const toNormalized = toCity.toLowerCase().trim();

  if (fromNormalized === toNormalized) {
    return { success: true, from: fromCity, to: toCity, distance: 0, via: 'Same city', source: 'identical' };
  }

  // Use Google Maps API if key is provided
  if (process.env.GOOGLE_MAPS_API_KEY) {
    try {
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(fromCity)}&destinations=${encodeURIComponent(toCity)}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
      const res = await axios.get(url);
      if (res.data && res.data.rows[0] && res.data.rows[0].elements[0].status === 'OK') {
        const distanceMeters = res.data.rows[0].elements[0].distance.value;
        const distanceKm = Math.round(distanceMeters / 1000);
        return { success: true, from: fromCity, to: toCity, distance: distanceKm, via: 'Google Maps Route', source: 'google_maps' };
      }
    } catch (error) {
      console.error('Google Maps API Error:', error.message);
    }
  }

  // Fallback to Free OSRM Routing Engine
  try {
    const originCoords = await getCoordinates(fromCity);
    const destCoords = await getCoordinates(toCity);

    if (originCoords && destCoords) {
      const url = `http://router.project-osrm.org/route/v1/driving/${originCoords.lon},${originCoords.lat};${destCoords.lon},${destCoords.lat}?overview=false`;
      const res = await axios.get(url);
      if (res.data && res.data.routes && res.data.routes.length > 0) {
        const distanceKm = Math.round(res.data.routes[0].distance / 1000);
        return { success: true, from: fromCity, to: toCity, distance: distanceKm, via: 'OSRM Open Routing', source: 'osrm_api' };
      }
    }
  } catch (error) {
    console.error('OSRM API Error:', error.message);
  }

  // Hard fallback if all APIs fail / No internet
  const seed = (fromNormalized + toNormalized).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return { success: true, from: fromCity, to: toCity, distance: 200 + (seed % 1800), via: 'Estimated route (API offline)', source: 'estimated' };
}

function getAvailableCities() {
  const cities = ['Delhi', 'Mumbai', 'Bangalore', 'Chennai', 'Kolkata', 'Hyderabad', 'Jaipur', 'Pune', 'Ahmedabad', 'Lucknow', 'Chandigarh'];
  return cities.sort();
}

// ═══════════════════════════════════════════════
// Block 3: Fuel Cost Calculation (API Async structure)
// ═══════════════════════════════════════════════
const VEHICLE_DEFAULTS = {
  truck: { defaultMileage: 5, defaultFuel: 'diesel' },
  van: { defaultMileage: 10, defaultFuel: 'diesel' },
  car: { defaultMileage: 15, defaultFuel: 'petrol' },
  bike: { defaultMileage: 40, defaultFuel: 'petrol' },
  tempo: { defaultMileage: 8, defaultFuel: 'diesel' },
  bus: { defaultMileage: 4, defaultFuel: 'diesel' },
};

async function fetchLiveFuelPrice(city, fuelType) {
  // If an external Fuel API is configured via .env
  if (process.env.FUEL_API_URL && process.env.FUEL_API_KEY) {
    try {
      const res = await axios.get(`${process.env.FUEL_API_URL}?city=${city}&type=${fuelType}`, {
        headers: { 'Authorization': `Bearer ${process.env.FUEL_API_KEY}` }
      });
      if (res.data && res.data.price) return res.data.price;
    } catch (error) {
      console.error('Fuel API Error:', error.message);
    }
  }
  
  // Fallback to static pricing since most real-time fuel APIs in India are paid
  const FALLBACK_PRICES = { petrol: 95.5, diesel: 88.2, cng: 75.0, electric: 15.0 };
  return FALLBACK_PRICES[fuelType.toLowerCase()] || 90.0;
}

async function calculateFuelCost(city, distance, mileage, fuelType, vehicleType) {
  const normalizedFuel = (fuelType || 'diesel').toLowerCase().trim();
  const normalizedVehicle = (vehicleType || 'truck').toLowerCase().trim();
  
  const effectiveMileage = mileage || (VEHICLE_DEFAULTS[normalizedVehicle]?.defaultMileage ?? 10);
  const effectiveFuelType = ['petrol', 'diesel', 'cng', 'electric'].includes(normalizedFuel)
    ? normalizedFuel : VEHICLE_DEFAULTS[normalizedVehicle]?.defaultFuel ?? 'diesel';

  const fuelPrice = await fetchLiveFuelPrice(city, effectiveFuelType);
  
  const fuelNeeded = parseFloat((distance / effectiveMileage).toFixed(2));
  const fuelCost = parseFloat((fuelNeeded * fuelPrice).toFixed(2));
  const costPerKm = parseFloat((fuelCost / (distance || 1)).toFixed(2));
  
  return { success: true, distance, mileage: effectiveMileage, fuelType: effectiveFuelType, fuelPricePerUnit: fuelPrice, fuelNeeded, fuelCost, costPerKm, vehicleType: normalizedVehicle, currency: 'INR' };
}

function getAvailableFuelTypes() {
  return [
    { type: 'petrol', pricePerUnit: 95.5, unit: 'litre' },
    { type: 'diesel', pricePerUnit: 88.2, unit: 'litre' },
    { type: 'cng', pricePerUnit: 75.0, unit: 'kg' },
    { type: 'electric', pricePerUnit: 15.0, unit: 'kWh' }
  ];
}

function getVehicleTypes() {
  return Object.entries(VEHICLE_DEFAULTS).map(([type, defaults]) => ({ type, ...defaults }));
}

// ═══════════════════════════════════════════════
// Block 4: Weather Simulation (Open-Meteo API)
// ═══════════════════════════════════════════════
async function fetchWeatherFromAPI(city) {
  try {
    const coords = await getCoordinates(city);
    if (!coords) throw new Error('Geocoding failed');

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m`;
    const res = await axios.get(url);
    const data = res.data.current;

    // Map WMO weather codes to our simple types
    // Codes: 0-2 (Clear/Cloudy), 51-67 (Rain), 80-82 (Showers), 95-99 (Thunderstorm)
    const code = data.weather_code;
    let weatherType = 'Clear';
    let rainProbability = 0;
    
    if (code >= 95 && code <= 99) {
      weatherType = 'Storm';
      rainProbability = 90;
    } else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
      weatherType = 'Rain';
      rainProbability = 75;
    } else if (code >= 1 && code <= 3) {
      weatherType = 'Cloudy';
      rainProbability = 15;
    }

    return {
      success: true,
      city,
      temperature: Math.round(data.temperature_2m),
      temperatureUnit: '°C',
      weatherType,
      rainProbability,
      humidity: data.relative_humidity_2m,
      windSpeed: Math.round(data.wind_speed_10m),
      windSpeedUnit: 'km/h',
      visibility: weatherType === 'Storm' ? 'Poor' : (weatherType === 'Rain' ? 'Moderate' : 'Good'),
      source: 'api.open-meteo.com',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Weather API Error for ${city}:`, error.message);
    // Fallback if network fails
    return {
      success: true, city, temperature: 30, temperatureUnit: '°C', weatherType: 'Clear',
      rainProbability: 25, humidity: 50, windSpeed: 10, windSpeedUnit: 'km/h',
      visibility: 'Good', source: 'fallback', timestamp: new Date().toISOString()
    };
  }
}

async function fetchRouteWeather(fromCity, toCity) {
  const origin = await fetchWeatherFromAPI(fromCity);
  const destination = await fetchWeatherFromAPI(toCity);
  const worstWeather = ['Storm', 'Rain', 'Cloudy', 'Clear'].find((w) => w === origin.weatherType || w === destination.weatherType) || 'Clear';
  const maxRainProb = Math.max(origin.rainProbability, destination.rainProbability);
  return {
    success: true, origin, destination,
    route: {
      weatherType: worstWeather, rainProbability: maxRainProb,
      overallVisibility: origin.visibility === 'Poor' || destination.visibility === 'Poor' ? 'Poor' : origin.visibility === 'Moderate' || destination.visibility === 'Moderate' ? 'Moderate' : 'Good',
    },
  };
}

// ═══════════════════════════════════════════════
// Block 5: AI Risk Analysis
// ═══════════════════════════════════════════════
function getThresholdScore(value, thresholds) {
  const sorted = Object.values(thresholds).sort((a, b) => b.threshold - a.threshold);
  for (const level of sorted) { if (value >= level.threshold) return level; }
  return sorted[sorted.length - 1];
}

const RISK_FACTORS = {
  weather: { Storm: { score: 40, label: 'Severe weather (storm) on route' }, Rain: { score: 20, label: 'Rainfall expected on route' }, Cloudy: { score: 5, label: 'Overcast skies on route' }, Clear: { score: 0, label: 'Clear weather conditions' } },
  rainProbability: { high: { threshold: 70, score: 25 }, medium: { threshold: 40, score: 12 }, low: { threshold: 0, score: 0 } },
  distance: { extreme: { threshold: 1500, score: 20, label: 'Extremely long distance route' }, long: { threshold: 800, score: 12, label: 'Long distance route' }, medium: { threshold: 400, score: 5, label: 'Medium distance route' }, short: { threshold: 0, score: 0 } },
  fuelCost: { extreme: { threshold: 15000, score: 15, label: 'Very high fuel expenditure' }, high: { threshold: 8000, score: 10, label: 'High fuel expenditure' }, medium: { threshold: 3000, score: 4, label: 'Moderate fuel expenditure' }, low: { threshold: 0, score: 0 } },
  visibility: { Poor: { score: 15, label: 'Poor visibility conditions' }, Moderate: { score: 5, label: 'Moderate visibility' }, Good: { score: 0 } },
  windSpeed: { dangerous: { threshold: 50, score: 20, label: 'Dangerous wind speeds' }, high: { threshold: 30, score: 10, label: 'High wind speeds' }, moderate: { threshold: 15, score: 3, label: 'Moderate winds' }, calm: { threshold: 0, score: 0 } },
};

function analyzeRisk(params) {
  const { distance, fuelCost, weatherType, rainProbability, visibility = 'Good', windSpeed = 10, vehicleType = 'truck', fromCity, toCity } = params;
  const factors = [];
  let totalScore = 0;

  const wf = RISK_FACTORS.weather[weatherType] || RISK_FACTORS.weather.Clear;
  totalScore += wf.score; if (wf.score > 0) factors.push(wf.label);

  const rf = getThresholdScore(rainProbability, RISK_FACTORS.rainProbability);
  totalScore += rf.score; if (rf.score > 0) factors.push('High rain probability');

  const df = getThresholdScore(distance, RISK_FACTORS.distance);
  totalScore += df.score; if (df.score > 0 && df.label) factors.push(df.label);

  const ff = getThresholdScore(fuelCost, RISK_FACTORS.fuelCost);
  totalScore += ff.score; if (ff.score > 0 && ff.label) factors.push(ff.label);

  const vf = RISK_FACTORS.visibility[visibility] || RISK_FACTORS.visibility.Good;
  totalScore += vf.score; if (vf.score > 0) factors.push(vf.label);

  const wndf = getThresholdScore(windSpeed, RISK_FACTORS.windSpeed);
  totalScore += wndf.score; if (wndf.score > 0 && wndf.label) factors.push(wndf.label);

  let riskLevel, riskColor;
  if (totalScore >= 55) { riskLevel = 'High'; riskColor = '#dc2626'; }
  else if (totalScore >= 25) { riskLevel = 'Medium'; riskColor = '#f59e0b'; }
  else { riskLevel = 'Low'; riskColor = '#16a34a'; }

  const reason = riskLevel === 'High'
    ? `The ${fromCity}–${toCity} route presents significant operational risk. ${factors.slice(0, 2).join(' combined with ')}. Current conditions exceed safe transit thresholds for ${vehicleType} operations, requiring immediate mitigation.`
    : riskLevel === 'Medium'
      ? `The ${fromCity}–${toCity} route carries moderate risk. ${factors.slice(0, 2).join(' and ')}. While serviceable, enhanced precautions are recommended.`
      : `The ${fromCity}–${toCity} route is operationally clear. Weather is favorable, costs within budget, no significant disruptions forecast.`;

  const recommendation = [];
  if (riskLevel === 'High') {
    recommendation.push('Postpone departure by 12–24 hours if weather window is expected to improve.');
    if (weatherType === 'Storm') recommendation.push('If dispatch is critical, deploy experienced drivers with secondary communication.');
    if (distance > 1200) recommendation.push(`Break the ${distance} km route into 2 legs with a mandatory overnight halt.`);
    recommendation.push('Increase insurance buffer by 15% and notify receiving hub of potential delay.');
  } else if (riskLevel === 'Medium') {
    recommendation.push('Proceed with standard precautions. Ensure driver rest compliance.');
    if (rainProbability > 40) recommendation.push('Equip rain-ready tarpaulins and reduce speed by 15% through wet zones.');
    if (fuelCost > 8000) recommendation.push('Consider mid-route refuelling depots for lower fuel costs.');
  } else {
    recommendation.push('Route is clear for immediate dispatch. Maintain standard protocols.');
    if (distance > 500) recommendation.push('Schedule a 30-minute driver rest stop at the midpoint.');
  }

  const alerts = [];
  if (riskLevel === 'High') alerts.push({ type: 'danger', message: `⚠️ High Risk Route Detected: ${fromCity} → ${toCity}. Consider delay or alternate routing.` });
  if (weatherType === 'Storm') alerts.push({ type: 'danger', message: '🌩️ Storm Alert: Active storm system detected on route corridor.' });
  if (windSpeed > 40) alerts.push({ type: 'warning', message: `💨 Wind Advisory: ${windSpeed} km/h winds. Secure all cargo.` });
  if (rainProbability > 60) alerts.push({ type: 'warning', message: `🌧️ Heavy Rain Warning: ${rainProbability}% precipitation probability.` });
  if (fuelCost > 15000) alerts.push({ type: 'info', message: `⛽ Cost Advisory: Fuel cost ₹${fuelCost.toLocaleString()} exceeds optimal threshold.` });
  if (riskLevel === 'Low' && alerts.length === 0) alerts.push({ type: 'success', message: '✅ All systems clear. Route is safe for dispatch.' });

  return { success: true, riskLevel, riskColor, riskScore: totalScore, maxScore: 135, reason, recommendation, factors, alerts, timestamp: new Date().toISOString() };
}

// ═══════════════════════════════════════════════
// Workflow Orchestrator
// ═══════════════════════════════════════════════
async function executeWorkflow(input) {
  const startTime = Date.now();
  const steps = [];

  try {
    const { fromCity, toCity, vehicleType, fuelType, mileage } = input;
    if (!fromCity || !toCity) throw new Error('Origin and destination cities are required.');

    steps.push({ block: 'trigger', label: 'Form Submission', status: 'completed', timestamp: Date.now() });

    // Block 2: Distance Calculation (Async)
    const distanceResult = await calculateDistance(fromCity, toCity);
    steps.push({ block: 'distance', label: 'Distance Calculation', status: 'completed', timestamp: Date.now() });

    // Block 3: Fuel Cost Calculation (Async)
    const fuelResult = await calculateFuelCost(fromCity, distanceResult.distance, parseFloat(mileage) || 0, fuelType, vehicleType);
    steps.push({ block: 'fuel', label: 'Fuel Cost Calculation', status: 'completed', timestamp: Date.now() });

    // Block 4: Weather Data (Async)
    const weatherResult = await fetchRouteWeather(fromCity, toCity);
    steps.push({ block: 'weather', label: 'Weather Analysis', status: 'completed', timestamp: Date.now() });

    // Block 5: AI Decision Agent
    const aiResult = analyzeRisk({
      distance: distanceResult.distance, fuelCost: fuelResult.fuelCost,
      weatherType: weatherResult.route.weatherType, rainProbability: weatherResult.route.rainProbability,
      visibility: weatherResult.route.overallVisibility,
      windSpeed: Math.max(weatherResult.origin.windSpeed, weatherResult.destination.windSpeed),
      vehicleType: vehicleType || 'truck', fromCity, toCity,
    });
    steps.push({ block: 'ai_agent', label: 'AI Risk Analysis', status: 'completed', timestamp: Date.now() });

    // Block 6 & 7: Condition and Output
    const isHighRisk = aiResult.riskLevel === 'High';
    steps.push({ block: 'condition', label: 'Risk Condition Check', status: 'completed', timestamp: Date.now() });
    steps.push({ block: 'output', label: 'Results Generated', status: 'completed', timestamp: Date.now() });

    return {
      success: true,
      summary: {
        route: `${fromCity} → ${toCity}`, distance: distanceResult.distance, distanceUnit: 'km',
        routeVia: distanceResult.via, routeSource: distanceResult.source,
        vehicleType: fuelResult.vehicleType, fuelType: fuelResult.fuelType, mileage: fuelResult.mileage,
        fuelNeeded: fuelResult.fuelNeeded, fuelCost: fuelResult.fuelCost, costPerKm: fuelResult.costPerKm, currency: 'INR',
      },
      weather: { origin: weatherResult.origin, destination: weatherResult.destination, route: weatherResult.route },
      risk: { level: aiResult.riskLevel, color: aiResult.riskColor, score: aiResult.riskScore, maxScore: aiResult.maxScore, reason: aiResult.reason, recommendation: aiResult.recommendation, factors: aiResult.factors, alerts: aiResult.alerts },
      condition: { result: isHighRisk, action: isHighRisk ? 'Route flagged as RISKY.' : 'Route marked as SAFE.' },
      pipeline: steps,
      meta: { executionTimeMs: Date.now() - startTime, blocksExecuted: steps.length, timestamp: new Date().toISOString() },
    };
  } catch (error) {
    return { success: false, error: error.message, pipeline: steps, meta: { executionTimeMs: Date.now() - startTime, blocksExecuted: steps.length, timestamp: new Date().toISOString() } };
  }
}

module.exports = { executeWorkflow, getAvailableCities, getAvailableFuelTypes, getVehicleTypes };
