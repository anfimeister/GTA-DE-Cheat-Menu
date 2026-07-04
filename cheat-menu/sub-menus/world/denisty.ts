import { CONFIG_PATH } from '../../config';

const SECTION = 'WORLD';
const DENSITY = {
    min: IniFile.ReadFloat(CONFIG_PATH, SECTION, 'MIN_DENSITY'),
    max: IniFile.ReadFloat(CONFIG_PATH, SECTION, 'MAX_DENSITY'),
};

export class DensitySubMenu {
    private pedDensity: number = IniFile.ReadFloat(CONFIG_PATH, SECTION, 'PED_DENSITY');
    private carDensity: number = IniFile.ReadFloat(CONFIG_PATH, SECTION, 'CAR_DENSITY');

    renderDensityMenu() {
        if (!ImGui.CollapsingHeader('Density')) {
            return;
        }
        const newPedDensity = this.renderDensitySubMenu('Ped density', this.pedDensity);
        const newCarDensity = this.renderDensitySubMenu('Car density', this.carDensity);

        if (this.pedDensity !== newPedDensity) {
            this.pedDensity = newPedDensity;
            World.SetPedDensityMultiplier(newPedDensity);
            IniFile.WriteFloat(newPedDensity, CONFIG_PATH, SECTION, 'PED_DENSITY');
        }
        if (this.carDensity !== newCarDensity) {
            this.carDensity = newCarDensity;
            World.SetCarDensityMultiplier(newCarDensity);
            IniFile.WriteFloat(newCarDensity, CONFIG_PATH, SECTION, 'CAR_DENSITY');
        }
    }

    private renderDensitySubMenu(label: string, density: number) {
        return ImGui.SliderFloat(label, density, DENSITY.min, DENSITY.max);
    }

    // Density is a momentary tool (e.g. thinning traffic for a race). The game resets
    // the ped/car multipliers to default when the player loses control (mission/load),
    // so rather than fight that, we let it default and snap the sliders back to 1.0 to
    // stay honest about what is actually applied.
    resetDisplayToDefault() {
        this.pedDensity = 1.0;
        this.carDensity = 1.0;
    }
}
