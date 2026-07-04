// Reads blip coordinates straight out of CRadar::ms_RadarTrace in game memory.
// There is no SCM/API getter for blip positions in SA:DE, so this is the only route.
//
// Verified by static analysis of SanAndreas.exe build 1.0.113.21181 (x64):
//   tRadarTrace stride 0x30, 250 entries, static array in .data (RVA 0x542A7B0).
//   +0x00 u32 colour          +0x14 u16 counter        +0x28 u8 sprite
//   +0x04 u32 entityHandle    +0x18 f32 sphereRadius   +0x29 u8 flags (0x02 = in use)
//   +0x08 f32 x (world)       +0x1C u16 blipSize       +0x2A u8 displayType:
//   +0x0C f32 y (world)       +0x20 ptr entryExit           bits 0-1 display, bits 2-5 type,
//   +0x10 f32 z (world)                                     bit 6 = map waypoint (DE-specific)
//
// The map waypoint is a coord blip with sprite 64 and bit 0x40 set on the displayType
// byte; the game's own set-waypoint code scans for exactly that bit, so we do too.
// The array address is found at runtime by signature scan (two independent code
// signatures that must agree), never hardcoded, so this survives ASLR and has a good
// chance of surviving game patches.

const TRACE_STRIDE = 0x30;
const TRACE_COUNT = 250;
const FLAG_IN_USE = 0x02;
const DT_WAYPOINT_BIT = 0x40;
const BLIP_TYPE_COORD = 4;

// 0 = not resolved yet, -1 = resolution failed (don't retry every click)
let cachedTraceArray = 0;

const dbg = (msg: string) => {
    try {
        log(`[waypoint] ${msg}`);
    } catch (_) { /* log() unavailable */ }
};

// CRadar::GetActualBlipArrayIndex:
//   cmp ecx,-1 / je / movzx eax,cx / lea r8,[rip+ms_RadarTrace] / shr ecx,0x10
// lea's disp32 is at match+11, next instruction at match+15.
const SIG_A = '83 F9 FF 74 ?? 0F B7 C1 4C 8D 05 ?? ?? ?? ?? C1 E9 10';
const SIG_A_EXACT = '83 F9 FF 74 24 0F B7 C1 4C 8D 05';
// Waypoint scan loop inside CRadar's set-custom-waypoint:
//   test byte [rax-1],2 / lea rsi,[rip+ms_RadarTrace] / mov ebx,-1 / je / test byte [rax],0x40
// lea's disp32 is at match+7, next instruction at match+11.
const SIG_B = 'F6 40 FF 02 48 8D 35 ?? ?? ?? ?? BB FF FF FF FF 74 ?? F6 00 40';
const SIG_B_EXACT = 'F6 40 FF 02 48 8D 35';

const resolveViaSignature = (sig: string, sigExact: string, dispOffset: int): number => {
    let match = Memory.FindPattern(sig, 0);
    if (match === undefined) {
        match = Memory.FindPattern(sigExact, 0);
    }
    if (match === undefined) {
        return 0;
    }
    const disp = Memory.ReadI32(match + dispOffset, false, false);
    return match + dispOffset + 4 + disp;
};

const findTraceArray = (): number => {
    if (cachedTraceArray > 0) {
        return cachedTraceArray;
    }
    if (cachedTraceArray === -1) {
        return 0;
    }

    const fromA = resolveViaSignature(SIG_A, SIG_A_EXACT, 11);
    const fromB = resolveViaSignature(SIG_B, SIG_B_EXACT, 7);
    dbg(`signature A -> ${fromA.toString(16)}, signature B -> ${fromB.toString(16)}`);

    let base = 0;
    if (fromA && fromB) {
        base = fromA === fromB ? fromA : 0; // disagreement = something changed, fail safe
    } else {
        base = fromA || fromB;
    }

    const imageBase = Memory.GetImageBase();
    if (base && (base <= imageBase || base >= imageBase + 0x10000000)) {
        dbg(`resolved address ${base.toString(16)} outside module range, rejecting`);
        base = 0;
    }

    cachedTraceArray = base || -1;
    if (!base) {
        dbg('failed to locate CRadar::ms_RadarTrace, blip teleport disabled');
    }
    return base;
};

interface TraceEntry {
    x: float;
    y: float;
    z: float;
    sprite: int;
    display: int;
    type: int;
    isWaypoint: boolean;
}

const readEntry = (base: number, i: int): TraceEntry | null => {
    const e = base + i * TRACE_STRIDE;
    const flags = Memory.ReadU8(e + 0x29, false, false);
    if ((flags & FLAG_IN_USE) === 0) {
        return null;
    }
    const dt = Memory.ReadU8(e + 0x2a, false, false);
    return {
        x: Memory.ReadFloat(e + 0x08, false, false),
        y: Memory.ReadFloat(e + 0x0c, false, false),
        z: Memory.ReadFloat(e + 0x10, false, false),
        sprite: Memory.ReadU8(e + 0x28, false, false),
        display: dt & 0x03,
        type: (dt >> 2) & 0x0f,
        isWaypoint: (dt & DT_WAYPOINT_BIT) !== 0,
    };
};

// SA world is roughly -3000..3000; anything far outside means we're misreading.
const coordsLookValid = (e: TraceEntry): boolean =>
    Math.abs(e.x) <= 6000 && Math.abs(e.y) <= 6000 &&
    e.z >= -150 && e.z <= 2000 &&
    !(e.x === 0 && e.y === 0);

const logInUseEntries = (base: number) => {
    for (let i = 0; i < TRACE_COUNT; i++) {
        const e = readEntry(base, i);
        if (e) {
            dbg(`trace[${i}] sprite=${e.sprite} type=${e.type} display=${e.display} wp=${e.isWaypoint} pos=(${e.x.toFixed(1)}, ${e.y.toFixed(1)}, ${e.z.toFixed(1)})`);
        }
    }
};

/** Coordinates of the player-placed map waypoint, or null when none is set. */
export const readWaypointCoords = (): Vector3 | null => {
    const base = findTraceArray();
    if (!base) {
        return null;
    }
    for (let i = 0; i < TRACE_COUNT; i++) {
        const e = readEntry(base, i);
        if (e && e.isWaypoint && coordsLookValid(e)) {
            return { x: e.x, y: e.y, z: e.z };
        }
    }
    dbg('no waypoint blip found; dumping in-use radar traces:');
    logInUseEntries(base);
    return null;
};

/** Coordinates of the current mission objective blip (nearest coord blip first,
 *  entity blips as fallback), or null when no mission blip exists. */
export const readMissionBlipCoords = (px: float, py: float): Vector3 | null => {
    const base = findTraceArray();
    if (!base) {
        return null;
    }
    let bestCoord: TraceEntry | null = null;
    let bestCoordDist = Infinity;
    let bestEntity: TraceEntry | null = null;
    let bestEntityDist = Infinity;

    for (let i = 0; i < TRACE_COUNT; i++) {
        const e = readEntry(base, i);
        // sprite 0 = plain colored mission blip; sprite blips (shops, contact points,
        // the waypoint) are never the mission objective marker
        if (!e || e.isWaypoint || e.display === 0 || e.sprite !== 0 || !coordsLookValid(e)) {
            continue;
        }
        const dist = (e.x - px) * (e.x - px) + (e.y - py) * (e.y - py);
        if (e.type === BLIP_TYPE_COORD) {
            if (dist < bestCoordDist) {
                bestCoordDist = dist;
                bestCoord = e;
            }
        } else if (e.type >= 1 && e.type <= 3) { // car/char/object blip
            if (dist < bestEntityDist) {
                bestEntityDist = dist;
                bestEntity = e;
            }
        }
    }

    const hit = bestCoord || bestEntity;
    if (!hit) {
        dbg('no mission blip found; dumping in-use radar traces:');
        logInUseEntries(base);
        return null;
    }
    return { x: hit.x, y: hit.y, z: hit.z };
};
