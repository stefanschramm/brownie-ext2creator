#!/usr/bin/env node

const ext2 = require('../');
const fs = require('fs');

if (process.argv[2] == undefined) {
	throw new Error('Please specify partition size');
}

if (process.argv[3] == undefined) {
	throw new Error('Please specify output filename');
}

let fd = fs.openSync(process.argv[3], 'w+');

let partitionSize = process.argv[2];
ext2.initExt2(fd, partitionSize);

fs.closeSync(fd)


