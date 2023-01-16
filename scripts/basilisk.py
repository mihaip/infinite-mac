import os.path
import paths
import subprocess
import typing


def run(disk_paths: typing.List[str], modelid: int = 14) -> None:
    rom_path = os.path.join(paths.DATA_DIR, "Quadra-650.rom")
    basilisk_ii_args = [
        ("--config", "none"),
    ] + [("--disk", p) for p in disk_paths] + [
        ("--extfs", "none"),
        ("--rom", rom_path),
        ("--screen", "win/800/600"),
        ("--ramsize", "134217728"),
        ("--frameskip", "0"),
        ("--modelid", str(modelid)),
        ("--cpu", "4"),
        ("--fpu", "true"),
        ("--nocdrom", "true"),
        ("--nosound", "true"),
        ("--noclipconversion", "true"),
        ("--idlewait", "true"),
    ]
    subprocess.check_call([
        "open",
        "-a",
        "BasiliskII",
        "-W",
        "--args",
    ] + [a for arg in basilisk_ii_args for a in arg])
