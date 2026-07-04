import { KeyCode, ImGuiCond } from '../../.config/enums';
import { getPos, teleport, readWaypointCoords, readMissionBlipCoords, getBoolean, saveBoolean } from '../functions/index';
import { CONFIG_PATH } from '../config';
import { PlayerTab } from './tab';
import { Location, MenuChar, MenuPlayer } from '../models';

interface SavedLocation {
    name: string;
    x: number;
    y: number;
    z: number;
}

const TELEPORT_SECTION = 'TELEPORT';

export class TeleportTab extends PlayerTab {
    private savedPosition: Vector3 | null = null;
    private lastPosition: Vector3 | null = null;
    private isSaveWindowOpen: boolean = false;
    private inputName: string = "";
    
    private customLocations: SavedLocation[] = [];
    // On unless explicitly turned off, mirroring how the cheats default on.
    private shortcutsActive: boolean =
        IniFile.ReadString(CONFIG_PATH, TELEPORT_SECTION, 'SHORTCUTS_ACTIVE') !== 'FALSE';

    constructor(
        player: MenuPlayer,
        playerChar: MenuChar,
        private readonly teleportOptions: Location[]
    ) {
        super(player, playerChar);
        this.loadIniLocations();
    }

    private loadIniLocations() {
        const iniPath = "CLEO/saved-locations.ini";
        const sectionKeys = "Locations";

        const keysString = IniFile.ReadString(iniPath, sectionKeys, "keys");
        if (!keysString) return;

        const keys = keysString.split(",");
        keys.forEach((key) => {
            const value = IniFile.ReadString(iniPath, key, "pos");
            if (value) {
                const parts = value.split(",").map(Number);
                if (parts.length === 3 && parts.every((n) => !isNaN(n))) {
                    this.customLocations.push({
                        name: key,
                        x: parts[0],
                        y: parts[1],
                        z: parts[2],
                    });
                }
            }
        });
    }

    renderTabUI() {
        ImGui.Text(`Keyboard shortcuts:`);
        ImGui.TextWithBullet('SHIFT + F8: Save your position');
        ImGui.TextWithBullet('SHIFT + F9: Teleport to saved position');
        ImGui.TextWithBullet('SHIFT + F10: Teleport to previous position');
        ImGui.TextWithBullet('SHIFT + F11: Save your position with name');

        ImGui.Separator();

        if (ImGui.Button('Teleport to waypoint', 220, 40)) {
            this.teleportToRadarBlip('waypoint');
        }
        ImGui.SameLine();
        if (ImGui.Button('Teleport to mission blip', 220, 40)) {
            this.teleportToRadarBlip('mission');
        }

        const shortcutsActive = ImGui.Checkbox('SHIFT + F6 / F7 - Waypoint / mission teleport hotkeys', this.shortcutsActive);
        if (this.shortcutsActive !== shortcutsActive) {
            this.shortcutsActive = shortcutsActive;
            saveBoolean(TELEPORT_SECTION, 'SHORTCUTS_ACTIVE', shortcutsActive);
        }

        ImGui.Separator();

        this.teleportOptions.forEach((teleportOption) => {
            if (ImGui.CollapsingHeader(teleportOption.name)) {
                if (teleportOption.groups) {
                    teleportOption.groups.forEach((group) => {
                        // ## suffix keeps ImGui IDs unique across categories sharing a sub-group label (e.g. "1-25")
                        if (ImGui.CollapsingHeader(`${group.name}##${teleportOption.name}`)) {
                            group.locations.forEach((vector) => {
                                if (ImGui.Selectable(`${vector.name}##${teleportOption.name}:${group.name}`, false)) {
                                    teleport(this.playerChar, vector);
                                }
                            });
                        }
                    });
                } else if (teleportOption.locations) {
                    teleportOption.locations.forEach((vector) => {
                        if (ImGui.Selectable(vector.name, false)) {
                            teleport(this.playerChar, vector);
                        }
                    });
                }
            }
        });

        if (this.customLocations.length > 0) {
            if (ImGui.CollapsingHeader("Custom Locations")) {
                this.customLocations.forEach((loc) => {
                    if (ImGui.Selectable(loc.name, false)) {
                        teleport(this.playerChar, loc);
                    }
                });
            }
        }
    }

    // Teleport to a blip read from CRadar memory (map waypoint / mission objective).
    // We move the player first, then let the scene stream in around them and correct the
    // ground Z. We must NOT use the blocking Streaming.LoadScene: with the heavy texture
    // mods it can exceed CLEO's 2-second no-yield timeout and kill the script (that was
    // the mission-teleport crash). Ctrl+Z returns as usual.
    private teleportToRadarBlip(kind: 'waypoint' | 'mission') {
        const pos = getPos(this.playerChar);
        const target = kind === 'waypoint'
            ? readWaypointCoords()
            : readMissionBlipCoords(pos.x, pos.y);

        if (!target) {
            showTextBox(kind === 'waypoint'
                ? 'No waypoint set (or memory scan failed, see cleo_redux.log)'
                : 'No mission blip found (see cleo_redux.log)');
            return;
        }

        this.lastPosition = pos;

        // Mission blips can carry a real checkpoint Z (interior / upper floor); trust it.
        // Otherwise drop the player in high above the X/Y and find the ground below.
        const hasRealZ = kind === 'mission' && target.z !== 0 && target.z > -100 && target.z < 2000;
        const dropZ = hasRealZ ? target.z : 300.0;

        // Move first + request collision, then yield so it streams around the player.
        // wait() resets the 2s timeout; no blocking LoadScene needed.
        Streaming.RequestCollision(target.x, target.y);
        teleport(this.playerChar, { x: target.x, y: target.y, z: dropZ });
        wait(500);

        if (!hasRealZ) {
            const groundZ = World.GetGroundZFor3DCoord(target.x, target.y, dropZ);
            const finalZ = groundZ > 0 ? groundZ + 1.0 : 1.0; // <=0: water / no collision -> surface
            teleport(this.playerChar, { x: target.x, y: target.y, z: finalZ });
        }

        showTextBox(kind === 'waypoint' ? 'Teleported to waypoint' : 'Teleported to mission blip');
    }

    updateGameState() {
        // Teleport hotkeys (toggle in the Teleport tab). Runs only while the player is
        // in control (this whole method is gated by isPlaying in the render loop).
        if (this.shortcutsActive && Pad.IsKeyPressed(KeyCode.Shift)) {
            if (Pad.IsKeyPressed(KeyCode.F6)) {
                this.teleportToRadarBlip('waypoint');
            } else if (Pad.IsKeyPressed(KeyCode.F7)) {
                this.teleportToRadarBlip('mission');
            }
        }

        if (Pad.IsKeyPressed(KeyCode.Shift) && Pad.IsKeyPressed(KeyCode.F8)) {
            this.savedPosition = getPos(this.playerChar);
            showTextBox(`Position saved`);
        }

        if (Pad.IsKeyPressed(KeyCode.Shift) && Pad.IsKeyPressed(KeyCode.F9) && this.savedPosition) {
            this.lastPosition = getPos(this.playerChar);
            teleport(this.playerChar, this.savedPosition);
            showTextBox(`Teleported to saved position`);
        }

        if (Pad.IsKeyPressed(KeyCode.Shift) && Pad.IsKeyPressed(KeyCode.F10) && this.lastPosition) {
            teleport(this.playerChar, this.lastPosition);
            showTextBox(`Teleported to previous position`);
        }

        if (Pad.IsKeyPressed(KeyCode.Shift) && Pad.IsKeyPressed(KeyCode.F11)) {
            this.inputName = "";
            this.isSaveWindowOpen = !this.isSaveWindowOpen;
            wait(200); 
        }

        if (this.isSaveWindowOpen) {
            ImGui.SetCursorVisible(true);
            ImGui.SetNextWindowSize(700, 300, ImGuiCond.FirstUseEver);

            if (ImGui.Begin("Save location", this.isSaveWindowOpen, false, false, false, false)) {
                ImGui.Text("Location name:");
                this.inputName = ImGui.InputText("##locName");

                if (ImGui.Button("Save", 100, 50) && this.inputName) {
                    const pos = getPos(this.playerChar);
                    const iniPath = "CLEO/saved-locations.ini";
                    const sectionKeys = "Locations";

                    IniFile.WriteString(`${pos.x},${pos.y},${pos.z}`, iniPath, this.inputName, "pos");

                    // Actualizamos la lista de keys
                    let keysString = IniFile.ReadString(iniPath, sectionKeys, "keys") || "";
                    const keys = keysString ? keysString.split(",") : [];
                    if (!keys.includes(this.inputName)) keys.push(this.inputName);
                    IniFile.WriteString(keys.join(","), iniPath, sectionKeys, "keys");

                    this.customLocations.push({ name: this.inputName, x: pos.x, y: pos.y, z: pos.z });

                    showTextBox(`Location "${this.inputName}" saved`);
                    this.isSaveWindowOpen = false;
                    this.inputName = "";
                }

                ImGui.SameLine();
                if (ImGui.Button("Cancel", 100, 50)) {
                    this.inputName = "";
                    this.isSaveWindowOpen = false;
                }

                ImGui.End();
            }
        }
    }
}
