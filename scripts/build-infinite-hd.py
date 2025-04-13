#!/usr/bin/env python3

import library
import sys

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: build-infinite-hd.py <destination>")
        sys.exit(1)
    destination_path = sys.argv[1]
    _, image, _ = library.build_images()
    with open(destination_path, "wb") as f:
        f.write(image)
