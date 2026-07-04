import { KeyCode, ImGuiCond } from '../.config/enums';
import { Events } from './data/index';
import { CONFIG_PATH } from './config';

import { Tab } from './tabs/tab';

type Tabs = { name: string, tab: Tab }[];

const USER_INPUT_DELAY = 250;
const CONFIG_SECTION = 'GUI';
const GUI_CONFIG = {
    width: IniFile.ReadInt(CONFIG_PATH, CONFIG_SECTION, 'WIDTH') ?? 720,
    height: IniFile.ReadInt( CONFIG_PATH, CONFIG_SECTION, 'HEIGHT') ?? 1280,
    noTitleBar: false,
    noResize: false,
    noMove: false,
    autoResize: false,
    show: false,
}

export const renderGui = (tabs: Tabs) => {
    const tabNames = tabs.map(({ name }) => name).join(',');
    const player = new Player(0);

    // FIXME asyncAwait freeze script after a while
    while (true) {
        // @Note without it script is terminated
        // https://re.cleo.li/docs/en/script-lifecycle.html
        wait(0);

        if (Pad.IsKeyPressed(KeyCode.F1)) {
            GUI_CONFIG.show = !GUI_CONFIG.show;
            wait(USER_INPUT_DELAY);
        }

        ImGui.BeginFrame('mk-gui');
        ImGui.SetCursorVisible(GUI_CONFIG.show);

        if (GUI_CONFIG.show) {
            ImGui.SetNextWindowSize(GUI_CONFIG.width, GUI_CONFIG.height, ImGuiCond.FirstUseEver);
            ImGui.Begin(
                '[MK] GTA Definitive Edition',
                GUI_CONFIG.show,
                GUI_CONFIG.noTitleBar,
                GUI_CONFIG.noResize,
                GUI_CONFIG.noMove,
                GUI_CONFIG.autoResize
            );

            const selectedTab = ImGui.Tabs('TabBar', tabNames);
            tabs[selectedTab]?.tab.renderTabUI();
            ImGui.End();
        }

        // Only apply per-frame game/player writes while the player is actually in
        // control. During mission cutscenes/transitions the ped handle is invalid and
        // these writes (setNeverGetsTired, setHealth, FreezeTimer, ...) crash the game
        // with an EXCEPTION_ACCESS_VIOLATION. isPlaying() is false during those windows.
        if (player.isPlaying()) {
            tabs.forEach(({ tab }) => tab.updateGameState());
        } else {
            // Not in control (loading/cutscene): let tabs resync state the game resets
            // (e.g. the density sliders), without touching the player.
            tabs.forEach(({ tab }) => { if (tab.onSuspended) tab.onSuspended(); });
        }

        ImGui.EndFrame();
    }
}
