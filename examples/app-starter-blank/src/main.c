#include <genesis.h>

int main(bool hardReset)
{
    (void)hardReset;

    VDP_setScreenWidth320();
    PAL_setColor(0, RGB24_TO_VDPCOLOR(0x102050));
    VDP_setBackgroundColor(0);
    VDP_clearPlane(BG_A, TRUE);
    VDP_clearPlane(BG_B, TRUE);

    while (TRUE)
    {
        SYS_doVBlankProcess();
    }

    return 0;
}
