#!/usr/bin/python

import base64
import glob
import json
import os.path
import zipfile

combined_manifest = {}

public_dir = os.path.join(os.path.dirname(__file__), "..", "public")

for zip_path in glob.iglob(os.path.join(public_dir, "Library", "**", "*.zip")):
    library_path, _ = os.path.splitext(os.path.relpath(zip_path, public_dir))

    with zipfile.ZipFile(zip_path, "r") as zip:
        items = []
        version = 0
        data_urls = {}
        for zip_info in zip.infolist():
            version = version ^ zip_info.CRC
            if not zip_info.filename.endswith("/"):
                items.append(zip_info.filename)
            # Inline files that are read as part of displaying the folder, so
            # that we don't need to download/parse the zip for them.
            if zip_info.filename in [
                    "DInfo",
                    "Icon\r",
                    ".rsrc/Icon\r",
                    ".finf/Icon\r",
            ]:
                data = zip.read(zip_info)
                data_url = ("data:application/octet-stream;base64,%s" %
                            base64.b64encode(data))
                data_urls[zip_info.filename] = data_url
        manifest = {
            "items": items,
            "version": version,
            "data_urls": data_urls,
        }
        combined_manifest["/" + library_path] = manifest

combined_path = os.path.join(os.path.dirname(__file__), "..", "src",
                             "BasiliskII", "emulator-library.json")
with open(combined_path, "w") as combined_file:
    json.dump(combined_manifest, combined_file, indent=4)
