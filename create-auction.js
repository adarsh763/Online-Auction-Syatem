/**
 * create-auction.js — Create Auction Page Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    if (!requireAuth()) return;

    const form = document.getElementById('create-auction-form');
    const submitBtn = document.getElementById('submit-btn');
    const successMsg = document.getElementById('success-message');

    // Set minimum end time to now + 1 hour
    const endTimeInput = document.getElementById('endTime');
    if (endTimeInput) {
        const minDate = new Date(Date.now() + 60 * 60 * 1000);
        endTimeInput.min = minDate.toISOString().slice(0, 16);
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideFormError('create-auction');

        // Client-side validation is removed as per the provided edit,
        // relying more on backend validation and error handling.

        const formData = new FormData();
        try {
            const title = document.getElementById('title').value.trim();
            const description = document.getElementById('description').value.trim();
            const startingPrice = document.getElementById('startingPrice').value;
            const endTime = document.getElementById('endTime').value;

            console.log('Form check:', { title: !!title, description: !!description, startingPrice: !!startingPrice, endTime: !!endTime });

            if (!title) throw new Error('Auction title is required.');
            if (!description) throw new Error('Description is required.');
            if (!startingPrice) throw new Error('Starting price is required.');
            if (!endTime) throw new Error('End date and time are required.');

            // Explicitly format the date
            const isoEndTime = new Date(endTime).toISOString();

            formData.append('title', title);
            formData.append('description', description);
            formData.append('startingPrice', startingPrice);
            formData.append('endTime', isoEndTime);

            const imageInput = document.getElementById('image');
            if (imageInput.files.length > 0) {
                console.log('Appending image file:', imageInput.files[0].name);
                formData.append('image', imageInput.files[0]);
            }

            console.log('Sending final FormData...');
            // In some environments, console.log(formData) is empty, so we don't rely on it.

            const res = await createAuction(formData);

            if (successMsg) {
                successMsg.style.display = 'block';
                successMsg.innerHTML = `
          Auction created successfully!
          <a href="auction-room.html?id=${res.data._id}" class="alert-link">View Auction →</a>
        `;
            }

            form.reset();
        } catch (err) {
            showFormError('create-auction', err.message || 'Failed to create auction.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create Auction';
        }
    });
});
