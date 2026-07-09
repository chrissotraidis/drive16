#include <genesis.h>
#include "resources.h"

#define COURT_X 4
#define COURT_Y 4
#define COURT_W 32
#define COURT_H 20
#define PADDLE_H 4
#define LEFT_PADDLE_X 2
#define RIGHT_PADDLE_X (COURT_W - 3)
#define BALL_START_X (COURT_W / 2)
#define BALL_START_Y (COURT_H / 2)
#define BALL_FRAMES 8
#define TILE_SOLID TILE_USER_INDEX
#define TILE_INSET (TILE_USER_INDEX + 1)
#define TILE_GRID (TILE_USER_INDEX + 2)

static const u32 presentation_tiles[24] = {
    0x11111111, 0x11111111, 0x11111111, 0x11111111,
    0x11111111, 0x11111111, 0x11111111, 0x11111111,
    0x11111111, 0x12222221, 0x12222221, 0x12222221,
    0x12222221, 0x12222221, 0x12222221, 0x11111111,
    0x11111111, 0x22222222, 0x11111111, 0x22222222,
    0x11111111, 0x22222222, 0x11111111, 0x22222222,
};

static s16 left_y;
static s16 right_y;
static s16 ball_x;
static s16 ball_y;
static s16 ball_dx;
static s16 ball_dy;
static u8 left_score;
static u8 right_score;
static u16 frame_counter;
static u16 previous_joy;
static bool presentation_ready;

static void draw_abs(s16 x, s16 y, const char *text)
{
    VDP_drawText(text, (u16)x, (u16)y);
}

static u16 art_tile(u16 palette, u16 tile)
{
    return TILE_ATTR_FULL(palette, FALSE, FALSE, FALSE, tile);
}

static void draw_tile(s16 x, s16 y, u16 palette, u16 tile)
{
    VDP_setTileMapXY(BG_A, art_tile(palette, tile), (u16)(COURT_X + x), (u16)(COURT_Y + y));
}

static void clear_at(s16 x, s16 y)
{
    VDP_setTileMapXY(BG_A, 0, (u16)(COURT_X + x), (u16)(COURT_Y + y));
}

static void draw_score(void)
{
    char score[] = "00-00";
    score[0] = (char)('0' + ((left_score / 10) % 10));
    score[1] = (char)('0' + (left_score % 10));
    score[3] = (char)('0' + ((right_score / 10) % 10));
    score[4] = (char)('0' + (right_score % 10));
    draw_abs(17, 2, score);
}

static void draw_court(void)
{
    VDP_fillTileMapRect(BG_B, art_tile(PAL1, TILE_GRID), COURT_X + 1, COURT_Y + 1, COURT_W - 2, COURT_H - 2);
    VDP_fillTileMapRect(BG_A, art_tile(PAL3, TILE_SOLID), COURT_X, COURT_Y, COURT_W, 1);
    VDP_fillTileMapRect(BG_A, art_tile(PAL3, TILE_SOLID), COURT_X, COURT_Y + COURT_H - 1, COURT_W, 1);
    VDP_fillTileMapRect(BG_A, art_tile(PAL3, TILE_SOLID), COURT_X, COURT_Y + 1, 1, COURT_H - 2);
    VDP_fillTileMapRect(BG_A, art_tile(PAL3, TILE_SOLID), COURT_X + COURT_W - 1, COURT_Y + 1, 1, COURT_H - 2);

    for (s16 y = 2; y < COURT_H - 1; y += 2)
    {
        draw_tile(COURT_W / 2, y, PAL3, TILE_INSET);
    }
}

static void draw_center_line(void)
{
    for (s16 y = 2; y < COURT_H - 1; y += 2)
    {
        draw_tile(COURT_W / 2, y, PAL3, TILE_INSET);
    }
}

static void draw_paddle(s16 x, s16 y)
{
    for (s16 i = 0; i < PADDLE_H; i++)
    {
        draw_tile(x, y + i, PAL2, TILE_INSET);
    }
}

static void clear_paddle(s16 x, s16 y)
{
    for (s16 i = 0; i < PADDLE_H; i++)
    {
        clear_at(x, y + i);
    }
}

static void draw_ball(void)
{
    draw_tile(ball_x, ball_y, PAL3, TILE_INSET);
}

static void serve_ball(s16 direction)
{
    ball_x = BALL_START_X;
    ball_y = BALL_START_Y;
    ball_dx = direction;
    ball_dy = 1;
    frame_counter = 0;
    draw_ball();
}

static void reset_game(void)
{
    const bool first_draw = !presentation_ready;
    if (!presentation_ready)
    {
        VDP_clearPlane(BG_A, TRUE);
        VDP_clearPlane(BG_B, TRUE);
        VDP_fillTileMapRect(BG_B, art_tile(PAL3, TILE_SOLID), 0, 0, 40, 4);
        VDP_fillTileMapRect(BG_B, art_tile(PAL3, TILE_SOLID), 0, 24, 40, 4);
        draw_abs(12, 1, "DRIVE16 // PONG");
        draw_abs(6, 25, "D-PAD MOVE   START RESET");
        presentation_ready = TRUE;
    }
    else
    {
        clear_paddle(LEFT_PADDLE_X, left_y);
        clear_paddle(RIGHT_PADDLE_X, right_y);
        clear_at(ball_x, ball_y);
    }

    left_score = 0;
    right_score = 0;
    left_y = (COURT_H - PADDLE_H) / 2;
    right_y = (COURT_H - PADDLE_H) / 2;

    draw_score();
    if (first_draw) draw_court();
    else draw_center_line();
    draw_paddle(LEFT_PADDLE_X, left_y);
    draw_paddle(RIGHT_PADDLE_X, right_y);
    serve_ball(1);
}

static void move_left_paddle(s16 delta)
{
    const s16 next_y = left_y + delta;
    if (next_y <= 1 || next_y + PADDLE_H >= COURT_H - 1)
    {
        return;
    }

    clear_paddle(LEFT_PADDLE_X, left_y);
    left_y = next_y;
    draw_paddle(LEFT_PADDLE_X, left_y);
}

static void move_right_ai(void)
{
    s16 next_y = right_y;
    if (ball_y < right_y + 1)
    {
        next_y--;
    }
    else if (ball_y > right_y + PADDLE_H - 2)
    {
        next_y++;
    }

    if (next_y <= 1 || next_y + PADDLE_H >= COURT_H - 1 || next_y == right_y)
    {
        return;
    }

    clear_paddle(RIGHT_PADDLE_X, right_y);
    right_y = next_y;
    draw_paddle(RIGHT_PADDLE_X, right_y);
}

static bool hits_paddle(s16 paddle_x, s16 paddle_y)
{
    return ball_x == paddle_x && ball_y >= paddle_y && ball_y < paddle_y + PADDLE_H;
}

static void point_for_left(void)
{
    if (left_score < 99)
    {
        left_score++;
    }
    draw_score();
    serve_ball(-1);
}

static void point_for_right(void)
{
    if (right_score < 99)
    {
        right_score++;
    }
    draw_score();
    serve_ball(1);
}

static void step_ball(void)
{
    clear_at(ball_x, ball_y);

    ball_x += ball_dx;
    ball_y += ball_dy;

    if (ball_y <= 1)
    {
        ball_y = 1;
        ball_dy = 1;
    }
    else if (ball_y >= COURT_H - 2)
    {
        ball_y = COURT_H - 2;
        ball_dy = -1;
    }

    if (ball_dx < 0 && hits_paddle(LEFT_PADDLE_X + 1, left_y))
    {
        ball_x = LEFT_PADDLE_X + 2;
        ball_dx = 1;
    }
    else if (ball_dx > 0 && hits_paddle(RIGHT_PADDLE_X - 1, right_y))
    {
        ball_x = RIGHT_PADDLE_X - 2;
        ball_dx = -1;
    }

    if (ball_x <= 0)
    {
        point_for_right();
        return;
    }
    if (ball_x >= COURT_W - 1)
    {
        point_for_left();
        return;
    }

    draw_ball();
}

static void read_input(void)
{
    const u16 joy = JOY_readJoypad(JOY_1);

    if ((joy & BUTTON_START) && !(previous_joy & BUTTON_START))
    {
        reset_game();
    }
    if (joy & BUTTON_UP)
    {
        move_left_paddle(-1);
    }
    else if (joy & BUTTON_DOWN)
    {
        move_left_paddle(1);
    }

    previous_joy = joy;
}

int main(bool hardReset)
{
    (void)hardReset;

    VDP_setScreenWidth320();
    PAL_setColor(0, RGB24_TO_VDPCOLOR(0x101840));
    PAL_setColor(17, RGB24_TO_VDPCOLOR(0x24366B));
    PAL_setColor(18, RGB24_TO_VDPCOLOR(0x18244A));
    PAL_setColor(31, RGB24_TO_VDPCOLOR(0x5D77C8));
    PAL_setColor(33, RGB24_TO_VDPCOLOR(0xFF6B5E));
    PAL_setColor(34, RGB24_TO_VDPCOLOR(0xFFB36B));
    PAL_setColor(47, RGB24_TO_VDPCOLOR(0xFFF3D6));
    PAL_setColor(49, RGB24_TO_VDPCOLOR(0x258FA8));
    PAL_setColor(50, RGB24_TO_VDPCOLOR(0x164D72));
    PAL_setColor(63, RGB24_TO_VDPCOLOR(0xF4FCFF));
    VDP_setBackgroundColor(0);
    VDP_loadTileData(presentation_tiles, TILE_SOLID, 3, CPU);
    VDP_setTextPalette(PAL3);
    JOY_init();
    XGM_startPlay(pong_loop);

    reset_game();

    while (TRUE)
    {
        read_input();

        frame_counter++;
        if (frame_counter >= BALL_FRAMES)
        {
            frame_counter = 0;
            move_right_ai();
            step_ball();
        }

        SYS_doVBlankProcess();
    }

    return 0;
}
