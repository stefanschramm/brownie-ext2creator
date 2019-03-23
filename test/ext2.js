const assert = require('assert');
const ext2 = require('../');
const fs = require('fs');

describe('ext2', function() {
	describe('#initExt2()', function() {
		it('should initialize an ext2 filesystem', function() {
			let fd = fs.openSync('outtest.img', 'w+');
			ext2.initExt2(fd, 1024 * 1024 * 8);
			fs.closeSync(fd);

			// TODO
			assert.equal(1, 1);
		});

	});
});

