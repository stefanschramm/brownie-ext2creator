#!/bin/sh

# Create partitions using mke2fs and initext2.js for comparing results

PARTITION_SIZE="$((1024*1024*${1}))"
IMAGE_1="ext2.img"
IMAGE_2="outtest.img"

rm "${IMAGE_1}"
rm "${IMAGE_2}"

touch testfiles/*

truncate -s "${PARTITION_SIZE}" "${IMAGE_1}"

# Start at the same time to (maybe) get same creation timestamp
node initext2.js "${PARTITION_SIZE}" "${IMAGE_2}" &
PID_1=$!
mke2fs -t ext2 -r 0 -m 0 -O ^ext_attr,^resize_inode,^dir_index,^filetype,^sparse_super -U "cafecafe-cafe-cafe-cafe-cafecafecafe" -d testfiles "${IMAGE_1}" &
PID_2=$!

wait $PID_1
wait $PID_2

hd ${IMAGE_1} > ${IMAGE_1}.txt
hd ${IMAGE_2} > ${IMAGE_2}.txt

dumpe2fs ${IMAGE_1} > ${IMAGE_1}.dumpe2fs.txt
dumpe2fs ${IMAGE_2} > ${IMAGE_2}.dumpe2fs.txt

