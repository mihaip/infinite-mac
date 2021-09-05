#!/usr/local/bin/python3

import json
import os
import sys

input_path = sys.argv[1]
output_path = sys.argv[2]

with open(input_path, "r") as input_file:
    source_map = json.load(input_file)

base_dir = os.path.dirname(input_path)
rewritten_sources = []
for path in source_map["sources"]:
    abs_path = os.path.abspath(os.path.join(base_dir, path))
    if os.path.exists(abs_path):
        rewritten_sources.append("file://" + abs_path)
    else:
        # Some paths are from the Emscripten SDK and are not actually on
        # disk (they are instead in the Emscripten Docker image). Leave those
        # alone.
        rewritten_sources.append(path)
source_map["sources"] = rewritten_sources

with open(output_path, "w+") as output_file:
    json.dump(source_map, output_file)
