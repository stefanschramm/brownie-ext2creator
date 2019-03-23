const assert = require('assert');
const bitfield = require('../bitfield');

describe('bitfield', function() {
	describe('#alloc()', function() {

		function runAllocTest(testCase, sliceArgument, expectedBufferHexString) {
			it(testCase, function() {
				let buf;
				buf = Buffer.alloc(16, 0x00);
				bitfield.alloc(buf, sliceArgument);
				assert.equal(buf.toString('hex'), expectedBufferHexString);
			});
		}

		runAllocTest('should set no bits if length of slice is 0', [0, 0], "00000000000000000000000000000000");
		runAllocTest('should set no bits if length of slice is 0 independently of beginning of slice', [4, 0], "00000000000000000000000000000000");
		runAllocTest('should set first byte in buffer to 0xff when 8 units are being allocated at the beginning', [0, 8], 'ff000000000000000000000000000000');
		runAllocTest('should set second byte in buffer to 0xff when 8 units are being allocated skipping the first 8 units', [8, 8], '00ff0000000000000000000000000000');
		runAllocTest('should set bits across byte boundaries if start of slice does not match byte boundary', [4, 8], 'f00f0000000000000000000000000000');
		runAllocTest('should set bits across byte boundaries if length of slice does not match byte boundary', [0, 12], 'ff0f0000000000000000000000000000');
		runAllocTest('should set single bit when slices with length 1 are allocated (at position 0)', [0, 1], '01000000000000000000000000000000');
		runAllocTest('should set single bit when slices with length 1 are allocated (at position 1)', [1, 1], '02000000000000000000000000000000');
		runAllocTest('should set single bit when slices with length 1 are allocated (at position 2)', [2, 1], '04000000000000000000000000000000');
		runAllocTest('should set single bit when slices with length 1 are allocated (at position 3)', [3, 1], '08000000000000000000000000000000');
		runAllocTest('should set single bit when slices with length 1 are allocated (at position 4)', [4, 1], '10000000000000000000000000000000');
		runAllocTest('should set single bit when slices with length 1 are allocated (at position 8)', [8, 1], '00010000000000000000000000000000');

		it('should throw exception when called with slice with negative length', function() {
			let buf = Buffer.alloc(16, 0x00);
			let exceptionMessage = '';
			try {
				bitfield.alloc(buf, [0, -1]);
			}
			catch (e) {
				exceptionMessage = e.message;
			}
			assert.equal(exceptionMessage, 'Invalid arguments');
		});

		it('should throw exception when called with slice with negative position', function() {
			let buf = Buffer.alloc(16, 0x00);
			let exceptionMessage = '(no exception thrown)';
			try {
				bitfield.alloc(buf, [-1, 1]);
			}
			catch (e) {
				exceptionMessage = e.message;
			}
			assert.equal(exceptionMessage, 'Invalid arguments');
		});
	});
	describe('#getFreeSlices', function() {
		it('should return one slice corresponding to beginning of 0-bitfield', function() {
			let buf = Buffer.alloc(16, 0x00);
			let result = bitfield.getFreeSlices(buf, 1);
			assert.deepEqual(result, [[0, 1]]);
		});
		it('should return one slice corresponding to beginning of 0-bitfield across byte boundaries', function() {
			let buf = Buffer.alloc(16, 0x00);
			let result = bitfield.getFreeSlices(buf, 12);
			assert.deepEqual(result, [[0, 12]]);
		});
		it('should return no slices corresponding when called on non-empty bitfield', function() {
			let buf = Buffer.alloc(16, 0xff);
			let result = bitfield.getFreeSlices(buf, 12);
			assert.deepEqual(result, []);
		});
		it('should return multiple slices if necessary', function() {
			let buf = Buffer.from('f0f0ffff', 'hex');
			let result = bitfield.getFreeSlices(buf, 8);
			assert.deepEqual(result, [[0, 4], [8, 4]]);
		});
		it('should throw exception when called negative length', function() {
			let buf = Buffer.alloc(16, 0x00);
			let exceptionMessage = '(no exception thrown)';
			try {
				bitfield.getFreeSlices(buf, -1);
			}
			catch (e) {
				exceptionMessage = e.message;
			}
			assert.equal(exceptionMessage, 'Invalid arguments');
		});
	});
});

