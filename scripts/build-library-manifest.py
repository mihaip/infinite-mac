#!/usr/bin/python

import glob
import json
import os.path

combined_manifest = {}

public_dir = os.path.join(os.path.dirname(__file__), "..", "public")

for manifest_path in glob.iglob(
        os.path.join(public_dir, "Library", "**", "*.json")):
    library_path, _ = os.path.splitext(
        os.path.relpath(manifest_path, public_dir))

    with open(manifest_path, "r") as manifest_file:
        manifest = json.load(manifest_file)
        combined_manifest["/" + library_path] = manifest

combined_path = os.path.join(os.path.dirname(__file__), "..", "src",
                             "BasiliskII", "emulator-library.json")
with open(combined_path, "w") as combined_file:
    json.dump(combined_manifest, combined_file, indent=4)
