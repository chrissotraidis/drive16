#include <genesis.h>
#include "resources.h"

#define FIELD_X 10
#define FIELD_Y 4
#define FIELD_W 10
#define FIELD_H 18
#define DROP_FRAMES 28
#define FAST_DROP_FRAMES 5
#define TILE_SOLID TILE_USER_INDEX
#define TILE_INSET (TILE_USER_INDEX + 1)
#define TILE_GRID (TILE_USER_INDEX + 2)

static const u32 presentation_tiles[24] = {
    0x11111111, 0x11111111, 0x11111111, 0x11111111,
    0x11111111, 0x11111111, 0x11111111, 0x11111111,
    0x11111111, 0x12222221, 0x12333321, 0x12333321,
    0x12333321, 0x12333321, 0x12222221, 0x11111111,
    0x11111111, 0x22222222, 0x11111111, 0x22222222,
    0x11111111, 0x22222222, 0x11111111, 0x22222222,
};

static u8 board[FIELD_H][FIELD_W];
static s16 piece_x;
static s16 piece_y;
static u8 piece_type;
static u8 piece_rot;
static u8 piece_index;
static u8 lines;
static u8 score;
static u16 frame_counter;
static u16 previous_joy;
static bool game_over;
static bool presentation_ready;

static const u8 piece_sequence[] = {2, 0, 1, 3, 2, 1, 0, 3};

static void draw_abs(s16 x, s16 y, const char *text)
{
    VDP_drawText(text, (u16)x, (u16)y);
}

static void draw_field(s16 x, s16 y, const char *text)
{
    draw_abs(FIELD_X + x, FIELD_Y + y, text);
}

static u16 art_tile(u16 palette, u16 tile)
{
    return TILE_ATTR_FULL(palette, FALSE, FALSE, FALSE, tile);
}

static void draw_field_tile(s16 x, s16 y, u16 palette, u16 tile)
{
    VDP_setTileMapXY(BG_A, art_tile(palette, tile), (u16)(FIELD_X + x), (u16)(FIELD_Y + y));
}

static u16 piece_palette(u8 type)
{
    static const u16 palettes[] = {PAL1, PAL2, PAL3, PAL2};
    return palettes[type & 3];
}

static bool piece_cell(u8 type, u8 rot, s16 x, s16 y)
{
    rot &= 3;

    if (type == 0)
    {
        return x < 2 && y < 2;
    }

    if (type == 1)
    {
        if (rot & 1)
        {
            return x == 1 && y >= 0 && y < 4;
        }
        return y == 1 && x >= 0 && x < 4;
    }

    if (type == 2)
    {
        if (rot == 0)
        {
            return (y == 1 && x >= 0 && x < 3) || (x == 1 && y == 0);
        }
        if (rot == 1)
        {
            return (x == 1 && y >= 0 && y < 3) || (x == 2 && y == 1);
        }
        if (rot == 2)
        {
            return (y == 1 && x >= 0 && x < 3) || (x == 1 && y == 2);
        }
        return (x == 1 && y >= 0 && y < 3) || (x == 0 && y == 1);
    }

    if (rot == 0)
    {
        return (x == 0 && y >= 0 && y < 3) || (y == 2 && x >= 0 && x < 3);
    }
    if (rot == 1)
    {
        return (y == 0 && x >= 0 && x < 3) || (x == 2 && y >= 0 && y < 3);
    }
    if (rot == 2)
    {
        return (x == 2 && y >= 0 && y < 3) || (y == 0 && x >= 0 && x < 3);
    }
    return (y == 2 && x >= 0 && x < 3) || (x == 0 && y >= 0 && y < 3);
}

static bool can_place(s16 px, s16 py, u8 rot)
{
    for (s16 y = 0; y < 4; y++)
    {
        for (s16 x = 0; x < 4; x++)
        {
            if (!piece_cell(piece_type, rot, x, y))
            {
                continue;
            }

            const s16 gx = px + x;
            const s16 gy = py + y;
            if (gx < 0 || gx >= FIELD_W || gy >= FIELD_H)
            {
                return FALSE;
            }
            if (gy >= 0 && board[gy][gx])
            {
                return FALSE;
            }
        }
    }
    return TRUE;
}

static void draw_stats(void)
{
    char line_text[] = "LINES 00";
    char score_text[] = "SCORE 00";
    line_text[6] = (char)('0' + ((lines / 10) % 10));
    line_text[7] = (char)('0' + (lines % 10));
    score_text[6] = (char)('0' + ((score / 10) % 10));
    score_text[7] = (char)('0' + (score % 10));
    draw_abs(2, 2, "DRIVE16 // TETRIS");
    draw_abs(24, 6, line_text);
    draw_abs(24, 8, score_text);
    draw_abs(24, 11, "UP/A ROTATE");
    draw_abs(24, 13, "D-PAD MOVE");
    draw_abs(24, 15, "START RESET");
}

static void draw_next_piece(void)
{
    const u8 next_type = piece_sequence[piece_index % (sizeof(piece_sequence) / sizeof(piece_sequence[0]))];
    draw_abs(24, 18, "NEXT");
    for (s16 y = 0; y < 4; y++)
    {
        for (s16 x = 0; x < 4; x++)
        {
            if (piece_cell(next_type, 0, x, y))
            {
                VDP_setTileMapXY(BG_A, art_tile(piece_palette(next_type), TILE_INSET), (u16)(25 + x), (u16)(20 + y));
            }
        }
    }
}

static void render(void)
{
    if (!presentation_ready)
    {
        VDP_clearPlane(BG_A, TRUE);
        VDP_clearPlane(BG_B, TRUE);
        VDP_fillTileMapRect(BG_B, art_tile(PAL3, TILE_SOLID), 0, 0, 40, 4);
        VDP_fillTileMapRect(BG_B, art_tile(PAL1, TILE_GRID), FIELD_X + 1, FIELD_Y + 1, FIELD_W, FIELD_H);
        VDP_fillTileMapRect(BG_B, art_tile(PAL1, TILE_GRID), 23, 5, 15, 20);
        presentation_ready = TRUE;
    }
    else
    {
        VDP_fillTileMapRect(BG_A, 0, FIELD_X + 1, FIELD_Y + 1, FIELD_W, FIELD_H);
        VDP_fillTileMapRect(BG_A, 0, 23, 5, 15, 20);
    }
    draw_stats();

    VDP_fillTileMapRect(BG_A, art_tile(PAL3, TILE_SOLID), FIELD_X, FIELD_Y, FIELD_W + 2, 1);
    VDP_fillTileMapRect(BG_A, art_tile(PAL3, TILE_SOLID), FIELD_X, FIELD_Y + FIELD_H + 1, FIELD_W + 2, 1);
    VDP_fillTileMapRect(BG_A, art_tile(PAL3, TILE_SOLID), FIELD_X, FIELD_Y + 1, 1, FIELD_H);
    VDP_fillTileMapRect(BG_A, art_tile(PAL3, TILE_SOLID), FIELD_X + FIELD_W + 1, FIELD_Y + 1, 1, FIELD_H);

    for (s16 y = 0; y < FIELD_H; y++)
    {
        for (s16 x = 0; x < FIELD_W; x++)
        {
            if (board[y][x])
            {
                draw_field_tile(x + 1, y + 1, piece_palette(board[y][x] - 1), TILE_INSET);
            }
        }
    }

    for (s16 y = 0; y < 4; y++)
    {
        for (s16 x = 0; x < 4; x++)
        {
            if (!piece_cell(piece_type, piece_rot, x, y))
            {
                continue;
            }
            const s16 gx = piece_x + x;
            const s16 gy = piece_y + y;
            if (gx >= 0 && gx < FIELD_W && gy >= 0 && gy < FIELD_H)
            {
                draw_field_tile(gx + 1, gy + 1, piece_palette(piece_type), TILE_INSET);
            }
        }
    }

    if (game_over)
    {
        draw_field(2, 8, "GAME OVER");
        draw_field(1, 10, "PRESS START");
    }
    draw_next_piece();
}

static void clear_lines(void)
{
    for (s16 y = FIELD_H - 1; y >= 0; y--)
    {
        bool full = TRUE;
        for (s16 x = 0; x < FIELD_W; x++)
        {
            if (!board[y][x])
            {
                full = FALSE;
                break;
            }
        }

        if (!full)
        {
            continue;
        }

        for (s16 row = y; row > 0; row--)
        {
            for (s16 x = 0; x < FIELD_W; x++)
            {
                board[row][x] = board[row - 1][x];
            }
        }
        for (s16 x = 0; x < FIELD_W; x++)
        {
            board[0][x] = 0;
        }
        if (lines < 99)
        {
            lines++;
        }
        if (score < 90)
        {
            score += 10;
        }
        y++;
    }
}

static void spawn_piece(void)
{
    piece_type = piece_sequence[piece_index % (sizeof(piece_sequence) / sizeof(piece_sequence[0]))];
    piece_index++;
    piece_rot = 0;
    piece_x = 3;
    piece_y = 0;
    frame_counter = 0;

    if (!can_place(piece_x, piece_y, piece_rot))
    {
        game_over = TRUE;
    }
}

static void lock_piece(void)
{
    for (s16 y = 0; y < 4; y++)
    {
        for (s16 x = 0; x < 4; x++)
        {
            if (!piece_cell(piece_type, piece_rot, x, y))
            {
                continue;
            }
            const s16 gx = piece_x + x;
            const s16 gy = piece_y + y;
            if (gx >= 0 && gx < FIELD_W && gy >= 0 && gy < FIELD_H)
            {
                board[gy][gx] = piece_type + 1;
            }
        }
    }

    clear_lines();
    spawn_piece();
}

static void step_piece(void)
{
    if (game_over)
    {
        return;
    }

    if (can_place(piece_x, piece_y + 1, piece_rot))
    {
        piece_y++;
    }
    else
    {
        lock_piece();
    }
    render();
}

static void reset_game(void)
{
    for (s16 y = 0; y < FIELD_H; y++)
    {
        for (s16 x = 0; x < FIELD_W; x++)
        {
            board[y][x] = 0;
        }
    }

    lines = 0;
    score = 0;
    piece_index = 0;
    previous_joy = 0;
    game_over = FALSE;
    spawn_piece();
    render();
}

static void read_input(void)
{
    const u16 joy = JOY_readJoypad(JOY_1);
    const u16 pressed = joy & ~previous_joy;

    if (pressed & BUTTON_START)
    {
        reset_game();
        previous_joy = joy;
        return;
    }

    if (!game_over)
    {
        if ((pressed & BUTTON_LEFT) && can_place(piece_x - 1, piece_y, piece_rot))
        {
            piece_x--;
            render();
        }
        else if ((pressed & BUTTON_RIGHT) && can_place(piece_x + 1, piece_y, piece_rot))
        {
            piece_x++;
            render();
        }

        if ((pressed & (BUTTON_UP | BUTTON_A)) && can_place(piece_x, piece_y, piece_rot + 1))
        {
            piece_rot = (piece_rot + 1) & 3;
            render();
        }
    }

    previous_joy = joy;
}

int main(bool hardReset)
{
    (void)hardReset;

    VDP_setScreenWidth320();
    PAL_setColor(0, RGB24_TO_VDPCOLOR(0x281038));
    PAL_setColor(17, RGB24_TO_VDPCOLOR(0x5A2A84));
    PAL_setColor(18, RGB24_TO_VDPCOLOR(0x311A52));
    PAL_setColor(19, RGB24_TO_VDPCOLOR(0xB96AF0));
    PAL_setColor(31, RGB24_TO_VDPCOLOR(0xE6B7FF));
    PAL_setColor(33, RGB24_TO_VDPCOLOR(0xE05A55));
    PAL_setColor(34, RGB24_TO_VDPCOLOR(0x8C2F4B));
    PAL_setColor(35, RGB24_TO_VDPCOLOR(0xFFB35A));
    PAL_setColor(47, RGB24_TO_VDPCOLOR(0xFFF0A8));
    PAL_setColor(49, RGB24_TO_VDPCOLOR(0x2C84A6));
    PAL_setColor(50, RGB24_TO_VDPCOLOR(0x164B70));
    PAL_setColor(51, RGB24_TO_VDPCOLOR(0x62D7E8));
    PAL_setColor(63, RGB24_TO_VDPCOLOR(0xF4FCFF));
    VDP_setBackgroundColor(0);
    VDP_loadTileData(presentation_tiles, TILE_SOLID, 3, CPU);
    VDP_setTextPalette(PAL3);
    JOY_init();
    XGM_startPlay(tetris_loop);

    reset_game();

    while (TRUE)
    {
        read_input();
        frame_counter++;
        const u16 drop_limit = (JOY_readJoypad(JOY_1) & BUTTON_DOWN) ? FAST_DROP_FRAMES : DROP_FRAMES;
        if (frame_counter >= drop_limit)
        {
            frame_counter = 0;
            step_piece();
        }
        SYS_doVBlankProcess();
    }

    return 0;
}
