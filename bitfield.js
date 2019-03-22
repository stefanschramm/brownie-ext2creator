
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

function free(buf, slice) {
	// slice: [start, length]
	if (slice[0] < 0 || slice[1] < 0) {
		throw new Error('Invalid arguments');
	}
	
	// TODO: optimize (use buf.fill() or at least loop via bytes instead of bits)
	for (let i = slice[0]; i < slice[0] + slice[1]; i++) {
		buf[Math.floor(i / 8)] &= ~(1 << (i % 8));
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

function testBitfield() {
	// No modification:
	testFree("ffffffff", "ffffffff", [0, 0]);
	testFree("ffffffff", "ffffffff", [4, 0]);
	testAlloc("00000000", "00000000", [0, 0]);
	testAlloc("00000000", "00000000", [4, 0]);
	// Aligned to bytes:
	testFree("ffffffff", "00ffffff", [0, 8]);
	testFree("ffffffff", "ff00ffff", [8, 8]);
	testFree("ffffffff", "ff0000ff", [8, 16]);
	testAlloc("00000000", "ff000000", [0, 8]);
	testAlloc("00000000", "00ff0000", [8, 8]);
	testAlloc("00000000", "00ffff00", [8, 16]);
	// Crossing byte boundaries:
	testFree("ffffffff", "f0ffffff", [0, 4]);
	testFree("ffffffff", "0ff0ffff", [4, 8]);
	testFree("ffffffff", "feffffff", [0, 1]);
	testFree("ffffffff", "efffffff", [4, 1]);
	testAlloc("00000000", "0f000000", [0, 4]);
	testAlloc("00000000", "f00f0000", [4, 8]);
	testAlloc("00000000", "01000000", [0, 1]);
	testAlloc("00000000", "10000000", [4, 1]);
	// Invalid arguments:
	try {
		testFree("ffffffff", "", [4, -1]);
		console.log('Problem - No exception got thrown.');
	}
	catch (e) {
		if (e.message == 'Invalid arguments') {
			console.log('OK');
		}
	}
	try {
		testFree("ffffffff", "", [-1, 1]);
		console.log('Problem - No exception got thrown.');
	}
	catch (e) {
		if (e.message == 'Invalid arguments') {
			console.log('OK');
		}
	}
	testGetFreeSlices('00ffffff', 4, [[0,4]]);
	testGetFreeSlices('00ffffff', 8, [[0,8]]);
	testGetFreeSlices('f0f0ffff', 8, [[0,4],[8,4]]);
	testGetFreeSlices('0ff0ffff', 8, [[4,8]]);
}

function testFree(before, assert, slice) {
	return testOperation(free, before, assert, slice);
}

function testAlloc(before, assert, slice) {
	return testOperation(alloc, before, assert, slice);
}

function testGetFreeSlices(bufStr, requested, assertSlice) {
	let buf = Buffer.from(bufStr, 'hex');
	let result = getFreeSlices(buf, requested);
	if (JSON.stringify(result) === JSON.stringify(assertSlice)) {
		console.log('OK');
	}
	else {
		console.log("Problem - Got: " + JSON.stringify(result) + ", expected: " + JSON.stringify(assertSlice));
	}
}


function testOperation(operation, before, assert, slice) {
	let buf = Buffer.from(before, 'hex');
	operation(buf, slice);
	if (buf.equals(Buffer.from(assert, 'hex'))) {
		console.log("OK");
	}
	else {
		console.log("Problem - Got: " + buf.toString('hex') + ", expected: " + assert);
	}
}

module.exports = {
	free: free,
	alloc: alloc,
	allocSlices: allocSlices,
	getFree: getFree,
	getFreeSlices: getFreeSlices
};

