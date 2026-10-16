import os.path
import subprocess
import typing

import paths


def run(disk_paths: typing.List[str]) -> None:
    rom_path = os.path.join(paths.DATA_DIR, "Mac-Plus.rom")
    subprocess.check_call(
        [
            "open",
            "-a",
            "Mini vMac",
            "-W",
            "--args",
        ]
        + [rom_path]
        + disk_paths
    )
