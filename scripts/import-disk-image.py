#!/usr/local/bin/python3

import brotli
import hashlib
import json
import os
import sys

input_path = sys.argv[1]
output_dir = sys.argv[2]
manifest_dir = sys.argv[3]

CHUNK_SIZE = 256 * 1024
chunk_count = 0
total_size = 0

input_file_name = os.path.basename(input_path)

hash = hashlib.sha256()

sys.stderr.write("Chunking and compressing %s" % input_file_name)
sys.stderr.flush()

with open(input_path, "rb") as input_file:
    while True:
        chunk = input_file.read(CHUNK_SIZE)
        if not chunk:
            break
        total_size += len(chunk)
        chunk_compressed = brotli.compress(chunk, quality=11)
        chunk_path = os.path.join(output_dir,
                                  f"{input_file_name}.{chunk_count}.br")
        # Use compressed version for the version hash so that if we change the
        # compression quality we can trigger a re-download.
        hash.update(chunk_compressed)
        with open(chunk_path, "wb+") as chunk_file:
            chunk_file.write(chunk_compressed)
        chunk_count += 1
        sys.stderr.write(".")
        sys.stderr.flush()

sys.stderr.write("\n")

manifest_path = os.path.join(manifest_dir, f"{input_file_name}.json")
with open(manifest_path, "w+") as manifest_file:
    json.dump(
        {
            "totalSize": total_size,
            "chunkCount": chunk_count,
            "chunkSize": CHUNK_SIZE,
            "version": hash.hexdigest()
        },
        manifest_file,
        indent=4)
