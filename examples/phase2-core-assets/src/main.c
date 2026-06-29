#include <genesis.h>
#include "resources.h"

#define PLAYER_SPEED 2
#define PLAYER_MIN_X 0
#define PLAYER_MAX_X 288
#define PLAYER_MIN_Y 24
#define PLAYER_MAX_Y 192

static Sprite *player;
static s16 playerX = 144;
static s16 playerY = 104;

static void updatePlayer(void)
{
    const u16 joy = JOY_readJoypad(JOY_1);

    if ((joy & BUTTON_LEFT) && (playerX > PLAYER_MIN_X))
        playerX -= PLAYER_SPEED;
    if ((joy & BUTTON_RIGHT) && (playerX < PLAYER_MAX_X))
        playerX += PLAYER_SPEED;
    if ((joy & BUTTON_UP) && (playerY > PLAYER_MIN_Y))
        playerY -= PLAYER_SPEED;
    if ((joy & BUTTON_DOWN) && (playerY < PLAYER_MAX_Y))
        playerY += PLAYER_SPEED;

    SPR_setPosition(player, playerX, playerY);
}

int main(bool hardReset)
{
    if (!hardReset)
        SYS_hardReset();

    JOY_init();
    SPR_init();

    PAL_setPalette(PAL1, drive16_player.palette->data, DMA);
    VDP_setTextPalette(PAL1);
    VDP_drawText("Drive16 Phase 2", 9, 3);
    VDP_drawText("Core bundled sprite", 5, 5);
    VDP_drawText("Core VGM loop plays", 5, 24);

    player = SPR_addSprite(&drive16_player, playerX, playerY, TILE_ATTR(PAL1, TRUE, FALSE, FALSE));
    if (player == NULL)
        SYS_die("Sprite allocation failed");

    XGM_startPlay(drive16_loop);

    while (TRUE)
    {
        updatePlayer();
        SPR_update();
        SYS_doVBlankProcess();
    }

    return 0;
}
