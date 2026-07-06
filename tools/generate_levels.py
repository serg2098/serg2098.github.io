# IQ Blast level generator.
# Generates 120 challenges (5 tiers x 24) for the authentic IQ-Blox board,
# each verified by exhaustive search to have exactly one solution. Run with:
#   python tools/generate_levels.py
# Output: js/levels.js (static data loaded by the page).
#
# Board: like the real IQ-Blox, an orthogonal grid rotated 45 degrees and
# cropped to a rectangle of 6 visual rows (6+5+6+5+6+5 = 33 holes); the
# top-left hole is unused, leaving 32 playable places. In underlying grid
# coordinates (u = row, v = col) the playable cells form a diamond-shaped
# mask inside an 8x8 grid; adjacency is orthogonal in (u,v), which appears
# diagonal on screen. Visual row j and half-step column i map to
# u = (i + j) / 2, v = (i - j) / 2 + 2.
#
# Approach: the piece set admits only a limited number of complete tilings,
# so we enumerate them all once. A piece may not span a wall edge, so a
# challenge (= set of wall edges) is solvable by exactly the tilings whose
# internal edges avoid every wall edge. Uniqueness testing is then a bitmask
# scan over all tilings instead of a backtracking search.

import json
import random
from itertools import combinations
from pathlib import Path

ROWS = 8
COLS = 8
CELL_COUNT = ROWS * COLS

# Authentic board mask: visual rows j=0..5; even rows have holes at
# half-steps i=0,2,..,10, odd rows at i=1,3,..,9. Hole (i=0, j=0) is the
# unused decorative hole. Cell numbering (1..32) follows visual rows.
VALID_CELLS = []  # (u, v) in visual-row order == printed numbering order
for j in range(6):
    for i in range(0 if j % 2 == 0 else 1, 11, 2):
        if i == 0 and j == 0:
            continue  # unused top-left hole
        u = (i + j) // 2
        v = (i - j) // 2 + 2
        VALID_CELLS.append((u, v))
assert len(VALID_CELLS) == 32

VALID_SET = set(VALID_CELLS)
VALID_MASK = 0
for u, v in VALID_CELLS:
    VALID_MASK |= 1 << (u * COLS + v)
FULL_MASK = (1 << CELL_COUNT) - 1
INVALID_MASK = FULL_MASK & ~VALID_MASK

# 7 pieces: 3 tetrominoes + 4 pentominoes = 32 cells, matching the physical set.
PIECES = [
    {"id": "P", "colorId": "cyan",    "blocks": [[1, 1], [1, 1], [1, 0]]},
    {"id": "S", "colorId": "purple",  "blocks": [[0, 1, 1], [1, 1, 0]]},
    {"id": "L", "colorId": "orange",  "blocks": [[1, 0], [1, 0], [1, 1]]},
    {"id": "T", "colorId": "magenta", "blocks": [[1, 1, 1], [0, 1, 0]]},
    {"id": "N", "colorId": "yellow",  "blocks": [[1, 0, 1], [1, 1, 1]]},
    {"id": "W", "colorId": "red",     "blocks": [[1, 0, 0], [1, 1, 0], [0, 1, 1]]},
    {"id": "J", "colorId": "green",   "blocks": [[1, 1, 0], [0, 1, 1], [0, 1, 0]]},
]

# Cut edges: adjacent cell pairs (in a piece's base orientation) that are drawn and
# treated as NOT joined, so a wall may pass between them and they are excluded from
# edge_mask. The P piece drops its (0,1)-(1,1) link so its closed "bowl" opens into
# an 'F'; this must match js/iq.js IQ_PIECE_CUTS.
PIECE_CUTS = {"P": [((0, 1), (1, 1))]}

# Note: exhaustive search proved no single wall yields a unique solution with
# this piece set, so Master and Wizard share a 48-challenge 2-wall pool that is
# split by difficulty (easier half -> Master, harder half -> Wizard).
TIERS = [
    {"name": "Starter", "walls": 4, "starters": (2, 3), "count": 24},
    {"name": "Junior",  "walls": 4, "starters": (0, 0), "count": 24},
    {"name": "Expert",  "walls": 3, "starters": (0, 0), "count": 24},
    {"name": "Master",  "walls": 2, "starters": (0, 0), "count": 48, "splitInto": "Wizard"},
]
TIER_NAMES = ["Starter", "Junior", "Expert", "Master", "Wizard"]

# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------

def rotate_blocks(blocks):
    rows, cols = len(blocks), len(blocks[0])
    return [[blocks[rows - 1 - r][c] for r in range(rows)] for c in range(cols)]


def flip_blocks(blocks):
    return [list(reversed(row)) for row in blocks]


# Cell transforms matching rotate_blocks / flip_blocks, used to carry a piece's cut
# edges through into each oriented placement.
def rotate_cell(cell, rows):
    r, c = cell
    return (c, rows - 1 - r)


def flip_cell(cell, cols):
    r, c = cell
    return (r, cols - 1 - c)


def oriented_cut_edges(piece, rot, flip):
    """Local (kind, r, c) edges that are cut in this orientation (flip then rot)."""
    base = piece["blocks"]
    rows, cols = len(base), len(base[0])
    edges = set()
    for a, b in PIECE_CUTS.get(piece["id"], []):
        r, c = rows, cols
        if flip:
            a, b = flip_cell(a, c), flip_cell(b, c)
        for _ in range(rot):
            a, b = rotate_cell(a, r), rotate_cell(b, r)
            r, c = c, r
        if a[0] == b[0]:
            edges.add(("h", a[0], min(a[1], b[1])))
        else:
            edges.add(("v", min(a[0], b[0]), a[1]))
    return edges


def blocks_key(blocks):
    return "/".join("".join(map(str, row)) for row in blocks)


# Interior edge ids over the 8x8 grid; only edges between two valid cells
# are ever used.
def h_edge(r, c):  # between (r,c)-(r,c+1), c in 0..COLS-2
    return r * (COLS - 1) + c


def v_edge(r, c):  # between (r,c)-(r+1,c), r in 0..ROWS-2
    return ROWS * (COLS - 1) + r * COLS + c


# All orientations (rotation x mirror), deduped per piece: list of (rot, flip, blocks).
piece_orients = []
for piece in PIECES:
    seen = {}
    for flip in (0, 1):
        blocks = flip_blocks(piece["blocks"]) if flip else piece["blocks"]
        for rot in range(4):
            key = blocks_key(blocks)
            if key not in seen:
                seen[key] = (rot, flip, blocks, oriented_cut_edges(piece, rot, flip))
            blocks = rotate_blocks(blocks)
    piece_orients.append(list(seen.values()))

# Every legal placement: (piece_idx, row, col, rot, flip, cell_mask, edge_mask).
# All covered cells must be valid board holes.
all_placements = []
for piece_idx, orients in enumerate(piece_orients):
    for rot, flip, blocks, cut_edges in orients:
        h, w = len(blocks), len(blocks[0])
        for row in range(ROWS - h + 1):
            for col in range(COLS - w + 1):
                mask = 0
                edge_mask = 0
                valid = True
                for r in range(h):
                    for c in range(w):
                        if not blocks[r][c]:
                            continue
                        if (row + r, col + c) not in VALID_SET:
                            valid = False
                            break
                        mask |= 1 << ((row + r) * COLS + (col + c))
                        if c + 1 < w and blocks[r][c + 1] and ("h", r, c) not in cut_edges:
                            edge_mask |= 1 << h_edge(row + r, col + c)
                        if r + 1 < h and blocks[r + 1][c] and ("v", r, c) not in cut_edges:
                            edge_mask |= 1 << v_edge(row + r, col + c)
                    if not valid:
                        break
                if valid:
                    all_placements.append((piece_idx, row, col, rot, flip, mask, edge_mask))

placements_by_cell = [[] for _ in range(CELL_COUNT)]
for placement in all_placements:
    mask = placement[5]
    for cell in range(CELL_COUNT):
        if mask & (1 << cell):
            placements_by_cell[cell].append(placement)

# ---------------------------------------------------------------------------
# Backtracking solver (used for difficulty scoring and independent self-check)
# ---------------------------------------------------------------------------

def count_solutions(wall_mask, forced, limit, capture_all=False):
    """Returns (count, nodes, solutions). Counts up to `limit` solutions."""
    occupied = INVALID_MASK  # non-board cells are permanently occupied
    used = 0
    chosen = []
    for placement in forced:
        if placement[6] & wall_mask:
            return 0, 0, []
        occupied |= placement[5]
        used |= 1 << placement[0]
        chosen.append(placement)

    state = {"count": 0, "nodes": 0, "occupied": occupied, "used": used}
    solutions = []

    def recurse():
        state["nodes"] += 1
        if state["occupied"] == FULL_MASK:
            state["count"] += 1
            if capture_all:
                solutions.append(list(chosen))
            return
        empty = ~state["occupied"] & FULL_MASK
        cell = (empty & -empty).bit_length() - 1  # lowest empty cell
        for placement in placements_by_cell[cell]:
            if state["used"] & (1 << placement[0]):
                continue
            if placement[5] & state["occupied"]:
                continue
            if placement[6] & wall_mask:
                continue
            state["occupied"] |= placement[5]
            state["used"] |= 1 << placement[0]
            chosen.append(placement)
            recurse()
            chosen.pop()
            state["occupied"] &= ~placement[5]
            state["used"] &= ~(1 << placement[0])
            if state["count"] >= limit:
                return

    recurse()
    return state["count"], state["nodes"], solutions


# ---------------------------------------------------------------------------
# Walls
# ---------------------------------------------------------------------------

OPEN_DIRS = ["u", "r", "d", "l"]


def wall_edges(r, c, open_dir):
    """U-shaped wall around cell (r,c), open toward open_dir; covers other 3 sides.
    Returns None if any covered side would not sit between two valid holes."""
    if (r, c) not in VALID_SET:
        return None
    sides = {
        "u": v_edge(r - 1, c) if (r - 1, c) in VALID_SET else None,
        "d": v_edge(r, c) if (r + 1, c) in VALID_SET else None,
        "l": h_edge(r, c - 1) if (r, c - 1) in VALID_SET else None,
        "r": h_edge(r, c) if (r, c + 1) in VALID_SET else None,
    }
    edges = []
    for d in OPEN_DIRS:
        if d == open_dir:
            continue
        if sides[d] is None:
            return None
        edges.append(sides[d])
    return edges


ALL_WALLS = []
for r in range(ROWS):
    for c in range(COLS):
        for open_dir in OPEN_DIRS:
            edges = wall_edges(r, c, open_dir)
            if edges is not None:
                mask = 0
                for e in edges:
                    mask |= 1 << e
                ALL_WALLS.append({"r": r, "c": c, "open": open_dir, "mask": mask})

# ---------------------------------------------------------------------------
# Challenge generation over the enumerated tiling set
# ---------------------------------------------------------------------------

class Tiling:
    __slots__ = ("placements", "edge_mask", "placement_set")

    def __init__(self, placements):
        self.placements = placements
        self.edge_mask = 0
        for p in placements:
            self.edge_mask |= p[6]
        self.placement_set = frozenset(p[:5] for p in placements)


def unique_solution_count(tilings, wall_mask, starter_keys):
    """How many tilings are compatible with the walls (and contain the starters)?"""
    count = 0
    for tiling in tilings:
        if tiling.edge_mask & wall_mask:
            continue
        if starter_keys and not starter_keys <= tiling.placement_set:
            continue
        count += 1
        if count > 1:
            return count
    return count


def disjoint_wall_sets(candidates, size, rng, cap):
    """Yields up to `cap` random subsets of pairwise-disjoint walls (distinct cells)."""
    combos = list(combinations(range(len(candidates)), size))
    rng.shuffle(combos)
    yielded = 0
    for combo in combos:
        walls = [candidates[i] for i in combo]
        mask = 0
        cells = set()
        ok = True
        for wall in walls:
            if wall["mask"] & mask or (wall["r"], wall["c"]) in cells:
                ok = False
                break
            mask |= wall["mask"]
            cells.add((wall["r"], wall["c"]))
        if not ok:
            continue
        yield walls, mask
        yielded += 1
        if yielded >= cap:
            return


def generate_tier(tier, tier_index, tilings, seen_keys, rng):
    found = []
    wall_count = tier["walls"]
    per_tiling_cap = 3  # solution variety: at most N challenges per target tiling
    order = list(range(len(tilings)))
    rng.shuffle(order)
    for round_cap in (1, per_tiling_cap):  # first pass: 1 per tiling, then relax
        per_tiling = {}
        for tiling_index in order:
            if len(found) >= tier["count"]:
                break
            tiling = tilings[tiling_index]
            if per_tiling.get(tiling_index, 0) >= round_cap:
                continue
            candidates = [w for w in ALL_WALLS if not (w["mask"] & tiling.edge_mask)]
            if len(candidates) < wall_count:
                continue
            for walls, wall_mask in disjoint_wall_sets(candidates, wall_count, rng, 400):
                starters = []
                starter_keys = frozenset()
                lo, hi = tier["starters"]
                if hi > 0:
                    starter_count = rng.randint(lo, hi)
                    starters = rng.sample(list(tiling.placements), starter_count)
                    starter_keys = frozenset(p[:5] for p in starters)
                key = (
                    frozenset((w["r"], w["c"], w["open"]) for w in walls),
                    starter_keys,
                )
                if key in seen_keys:
                    continue
                if unique_solution_count(tilings, wall_mask, starter_keys) != 1:
                    continue
                seen_keys.add(key)
                per_tiling[tiling_index] = per_tiling.get(tiling_index, 0) + 1
                found.append({
                    "tier": tier_index,
                    "walls": [[w["r"], w["c"], w["open"]] for w in walls],
                    "wall_mask": wall_mask,
                    "starters": [list(p[:5]) for p in starters],
                    "solution": [list(p[:5]) for p in tiling.placements],
                    "wallCount": wall_count,
                })
                break
            if len(found) >= tier["count"]:
                break
        if len(found) >= tier["count"]:
            break
    if len(found) < tier["count"]:
        raise SystemExit(f"Tier {tier['name']}: only found {len(found)}/{tier['count']}")

    # Difficulty = solver effort on the actual challenge.
    placement_index = {p[:5]: p for p in all_placements}
    for level in found:
        forced = [placement_index[tuple(s)] for s in level["starters"]]
        count, nodes, _ = count_solutions(level["wall_mask"], forced, 2)
        assert count == 1
        level["difficulty"] = nodes
    found.sort(key=lambda l: l["difficulty"])
    print(f"  [{tier['name']}] {len(found)} challenges at {wall_count} walls, "
          f"difficulty {found[0]['difficulty']}..{found[-1]['difficulty']} nodes",
          flush=True)
    return found


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    rng = random.Random(20260705)
    count, nodes, raw_solutions = count_solutions(0, [], 10 ** 9, capture_all=True)
    print(f"Board: {ROWS}x{COLS}. Total tilings with no walls: {count}", flush=True)
    if count == 0:
        raise SystemExit("Piece set cannot tile the board at all!")
    tilings = [Tiling(s) for s in raw_solutions]

    seen_keys = set()
    levels = []
    for tier_index, tier in enumerate(TIERS):
        print(f"Generating {tier['name']}...", flush=True)
        tier_levels = generate_tier(tier, tier_index, tilings, seen_keys, rng)
        if tier.get("splitInto"):
            # Easier half stays in this tier, harder half becomes the next one.
            half = len(tier_levels) // 2
            for level in tier_levels[half:]:
                level["tier"] = tier_index + 1
            print(f"  Split: {TIER_NAMES[tier_index]} {tier_levels[0]['difficulty']}.."
                  f"{tier_levels[half - 1]['difficulty']} nodes, "
                  f"{tier['splitInto']} {tier_levels[half]['difficulty']}.."
                  f"{tier_levels[-1]['difficulty']} nodes", flush=True)
        levels.extend(tier_levels)

    # Independent self-check with the backtracking solver.
    placement_index = {p[:5]: p for p in all_placements}
    wall_index = {(w["r"], w["c"], w["open"]): w for w in ALL_WALLS}
    for i, level in enumerate(levels):
        mask = 0
        for r, c, open_dir in level["walls"]:
            mask |= wall_index[(r, c, open_dir)]["mask"]
        forced = [placement_index[tuple(s)] for s in level["starters"]]
        n, _, solutions = count_solutions(mask, forced, 2, capture_all=True)
        if n != 1:
            raise SystemExit(f"Self-check failed at level {i + 1}: {n} solutions")
        solved = sorted(p[:5] for p in solutions[0])
        expected = sorted(tuple(s) for s in level["solution"])
        if solved != expected:
            raise SystemExit(f"Self-check failed at level {i + 1}: solution mismatch")
    print(f"Self-check passed: all {len(levels)} levels have exactly 1 solution.", flush=True)

    tier_names = TIER_NAMES
    pieces_js = ",\n".join(
        f"    {{ id: '{p['id']}', colorId: '{p['colorId']}', "
        f"blocks: {json.dumps(p['blocks'], separators=(',', ':'))} }}"
        for p in PIECES
    )
    levels_js = ",\n".join(
        "    { t: %d, w: %s, s: %s, sol: %s }" % (
            level["tier"],
            json.dumps(level["walls"], separators=(",", ":")),
            json.dumps(level["starters"], separators=(",", ":")),
            json.dumps(level["solution"], separators=(",", ":")),
        )
        for level in levels
    )
    output = f"""// Generated by tools/generate_levels.py - do not edit by hand.
// {len(levels)} IQ Blast challenges, each verified to have exactly one solution
// under IQ Blast rules (including the P piece's open 'F' cut edge).
// Level format: t=tier index, w=walls [row,col,open(u/r/d/l)] (U-shape open toward 'open'),
// s=starter pieces [piece,row,col,rot,flip], sol=the unique solution (same format).

const IQ_TIER_NAMES = {json.dumps(tier_names)};

const IQ_PIECES = [
{pieces_js}
];

const IQ_LEVELS = [
{levels_js}
];
"""
    out_path = Path(__file__).resolve().parent.parent / "js" / "levels.js"
    out_path.write_text(output, encoding="utf-8")
    print(f"Wrote {out_path}", flush=True)
    counts = ", ".join(
        f"{name}: {sum(1 for l in levels if l['tier'] == i)}"
        for i, name in enumerate(tier_names)
    )
    print(f"Tiers: {counts}", flush=True)


if __name__ == "__main__":
    main()
