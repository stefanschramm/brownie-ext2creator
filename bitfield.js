
function alloc(buf, slice) {
	// slice: [start, length]
	if (slice[0] < 0 || slice[1] < 0) {
		throw new Error('Invalid arguments');
	}
	
	// TODO: optimize (use buf.fill() or at least loop via bytes instead of bits)
	for (let i = slice[0]; i < slice[0] + slice[1]; i++) {
		buf[Math.floor(i / 8)] |= 1 << (i % 8);
	}
}

function allocSlices(buf, slices) {
	slices.forEach(s => {
		alloc(buf, s);
	});
}

function freeSlices(buf, slices) {
	slices.forEach(s => {
		alloc(buf, s);
	});
}

function getFree(buf) {
	let slices = getFreeSlices(buf, 1);
	if (slices.length === 0) {
		return false;
	}
	return slices[0][0];
}

function getFreeSlices(buf, freeRequested) {
	if (freeRequested < 0) {
		throw new Error('Invalid arguments');
	}
	// TODO: optimize
	let slices = [];
	let lastFree = false;
	let freeSum = 0;
	for (let i = 0; i < buf.length * 8 && freeSum < freeRequested; i++) {
		let free = (buf[Math.floor(i / 8)] & (1 << (i % 8))) == 0x00;
		if (free) {
			freeSum++;
			if (lastFree) {
				slices[slices.length-1][1]++;
			}
			else {
				slices.push([i, 1]);
			}
		}
		lastFree = free;
	}
	return slices;
}

module.exports = {
	alloc: alloc,
	allocSlices: allocSlices,
	getFree: getFree,
	getFreeSlices: getFreeSlices
};

