"""Build replay data from the New Horizons PDS SPICE archive.

Run with Python and spiceypy installed. Pass the directory holding the kernels
listed below. Download them from the archive's data/spk and data/lsk directories.
"""

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import spiceypy as spice


KERNELS = (
    "naif0012.tls",
    "nh_de433_od147.bsp",
    "jup365.bsp",
    "nh_recon_e2j_v1.bsp",
    "nh_recon_j2sep07_prelimv1.bsp",
    "nh_recon_od077_v01.bsp",
    "nh_recon_od117_v01.bsp",
    "nh_recon_pluto_od122_v01.bsp",
    "nh_plu047_od122.bsp",
    "nh_recon_arrokoth_od147_v01.bsp",
)
SOURCE = "https://naif.jpl.nasa.gov/pub/naif/pds/data/nh-j_p_ss-spice-6-v1.0/nhsp_1000/data/spk/spkinfo.txt"
START = "2006-01-19T19:00:00"
ENCOUNTERS = (
    ("jupiter", "599", "2007-02-28T05:43:40"),
    ("pluto", "999", "2015-07-14T11:49:00"),
    ("arrokoth", "2486958", "2019-01-01T05:33:22"),
)


def utc_ms(et):
    utc = datetime.fromisoformat(spice.et2utc(et, "ISOC", 3))
    return round(utc.replace(tzinfo=timezone.utc).timestamp() * 1000)


def state(et, center):
    return spice.spkezr("-98", et, "ECLIPJ2000", "NONE", center)[0]


def position_between(left, right, span, fraction):
    u = fraction
    return (
        (2 * u**3 - 3 * u**2 + 1) * left[:3]
        + (u**3 - 2 * u**2 + u) * span * left[3:]
        + (-2 * u**3 + 3 * u**2) * right[:3]
        + (u**3 - u**2) * span * right[3:]
    )


def sample_track(start, stop, step, tolerance, center, events):
    times = sorted({start, stop, *events, *np.arange(start, stop, step)})
    samples = [(times[0], state(times[0], center), False)]
    max_error = 0

    def append(end, right):
        nonlocal max_error
        begin, left, _ = samples[-1]
        span = end - begin
        error = max(
            np.linalg.norm(
                state(begin + fraction * span, center)[:3]
                - position_between(left, right, span, fraction)
            )
            for fraction in (0.25, 0.5, 0.75)
        )
        if error > tolerance and span > 0.5:
            middle = begin + span / 2
            append(middle, state(middle, center))
            append(end, right)
        elif error > tolerance and center == "SUN":
            # Neighboring archive solutions can disagree at the kernel boundary.
            # Do not turn a solution change into a spurious velocity spike.
            samples.append((end, right, True))
        else:
            max_error = max(max_error, error)
            samples.append((end, right, False))

    for end in times[1:]:
        append(end, state(end, center))
    assert max_error <= tolerance, (center, max_error, tolerance)
    boundaries = sum(boundary for _, _, boundary in samples)
    print(f"{center}: {len(samples)} samples, {boundaries} solution boundaries, tested interpolation error {max_error:.3f} km")
    return [
        [utc_ms(et), *[round(float(v), 7 if i >= 3 else 3) for i, v in enumerate(vector)], *([1] if boundary else [])]
        for et, vector, boundary in samples
    ]


def closest_approach(center, estimate):
    guess = spice.str2et(estimate)
    lower, upper = guess - 900, guess + 900
    for _ in range(42):
        middle = (lower + upper) / 2
        vector = state(middle, center)
        if np.dot(vector[:3], vector[3:]) < 0:
            lower = middle
        else:
            upper = middle
    return (lower + upper) / 2


def track_json(rows, indent):
    return "[\n" + ",\n".join(indent + json.dumps(row, separators=(",", ":")) for row in rows) + "\n" + indent[:-2] + "]"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("kernel_dir", type=Path)
    parser.add_argument("--output", type=Path, default=Path("src/data/newHorizonsTrack.json"))
    args = parser.parse_args()
    for name in KERNELS:
        spice.furnsh(str(args.kernel_dir / name))

    start = max(spice.str2et(START), spice.spkcov(str(args.kernel_dir / KERNELS[3]), -98)[0])
    stop = spice.spkcov(str(args.kernel_dir / KERNELS[-1]), -98)[-1] - 0.01
    encounters = [(key, center, closest_approach(center, utc)) for key, center, utc in ENCOUNTERS]
    overview = sample_track(start, stop, 4 * 86400, 20, "SUN", [et for _, _, et in encounters])
    lines = [
        "{",
        '  "source": ' + json.dumps(SOURCE) + ",",
        '  "kernels": ' + json.dumps(KERNELS) + ",",
        '  "launch": ' + str(utc_ms(spice.str2et(START))) + ",",
        '  "overview": ' + track_json(overview, "    ") + ",",
        '  "encounters": {',
    ]
    for index, (key, center, et) in enumerate(encounters):
        distance = float(np.linalg.norm(state(et, center)[:3]))
        speed = float(np.linalg.norm(state(et, center)[3:]))
        print(f"{key}: {spice.et2utc(et, 'ISOC', 3)} UTC, {distance:.3f} km center, {speed:.3f} km/s")
        span = {"jupiter": 24 * 3600, "pluto": 25 * 60, "arrokoth": 8 * 60}[key]
        samples = sample_track(et - span, et + span, span / 90, 0.02, center, [et])
        lines += [
            f'    "{key}": {{',
            f'      "time": {utc_ms(et)},',
            f'      "distanceKm": {distance:.3f},',
            f'      "speedKmS": {speed:.6f},',
            '      "samples": ' + track_json(samples, "        "),
            "    }" + ("," if index + 1 < len(encounters) else ""),
        ]
    lines += ["  }", "}", ""]
    args.output.write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    main()
