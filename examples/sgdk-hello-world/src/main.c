#include <genesis.h>

int main(bool hardReset)
{
    VDP_drawText("Drive16 Phase 0", 10, 12);
    VDP_drawText("Hello from SGDK", 10, 14);

    while (TRUE)
    {
        SYS_doVBlankProcess();
    }

    return 0;
}
