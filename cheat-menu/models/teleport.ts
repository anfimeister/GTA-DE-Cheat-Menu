export interface LocationGroup {
    name: string;
    locations: ({ name: string } & Vector3)[];
}

export interface Location {
    name: string;
    // A category either has a flat list of locations...
    locations?: ({ name: string } & Vector3)[];
    // ...or is split into named sub-groups (rendered as nested collapsing headers).
    groups?: LocationGroup[];
}
