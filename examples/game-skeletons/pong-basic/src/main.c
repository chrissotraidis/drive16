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

static void draw_at(s16 x, s16 y, const char *text)
{
    VDP_drawText(text, (u16)(COURT_X + x), (u16)(COURT_Y + y));
}

static void draw_abs(s16 x, s16 y, const char *text)
{
    VDP_drawText(text, (u16)x, (u16)y);
}

static void clear_at(s16 x, s16 y)
{
    draw_at(x, y, " ");
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
    for (s16 x = 0; x < COURT_W; x++)
    {
        draw_at(x, 0, "-");
        draw_at(x, COURT_H - 1, "-");
    }

    for (s16 y = 1; y < COURT_H - 1; y++)
    {
        draw_at(0, y, "|");
        draw_at(COURT_W - 1, y, "|");
        if ((y & 1) == 0)
        {
            draw_at(COURT_W / 2, y, ":");
        }
    }
}

static void draw_paddle(s16 x, s16 y)
{
    for (s16 i = 0; i < PADDLE_H; i++)
    {
        draw_at(x, y + i, "|");
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
    draw_at(ball_x, ball_y, "O");
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
    VDP_clearPlane(BG_A, TRUE);
    draw_abs(13, 1, "DRIVE16 PONG");
    draw_abs(6, 25, "D-PAD MOVE  START RESET");

    left_score = 0;
    right_score = 0;
    left_y = (COURT_H - PADDLE_H) / 2;
    right_y = (COURT_H - PADDLE_H) / 2;

    draw_score();
    draw_court();
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
    VDP_setBackgroundColor(0);
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
