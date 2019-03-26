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
let f = ext2.initExt2(fd, partitionSize, 1024);

console.log("initialized");

async function writeBrowniePlayerData(fd) {
	console.log("Creating directory /brownieplayer...");
	ext2.createDirectory(f, "/brownieplayer", {uid: 1000, gid: 1000, accessRights: 0755});
	console.log("Writing file 1...");
	await ext2.writeFileFromHostFileSystem(f, "/brownieplayer/2kb.txt", "testfiles/brownieplayer/2kb.txt");
	console.log("Writing file 2...");
	await ext2.writeFileFromHostFileSystem(f, "/brownieplayer/1kb.txt", "testfiles/brownieplayer/1kb.txt");
	fs.closeSync(fd);
}

writeBrowniePlayerData(fd)
	.then(() => {
		console.log("Done!");
	})
	.catch(err => {
		console.log("Problem: " + err);
	});

