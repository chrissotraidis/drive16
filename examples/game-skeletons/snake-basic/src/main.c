#include <genesis.h>
#include "resources.h"

#define BOARD_X 6
#define BOARD_Y 5
#define BOARD_W 20
#define BOARD_H 18
#define MAX_SNAKE 48
#define START_SNAKE 3
#define MOVE_FRAMES 24

typedef struct
{
    s16 x;
    s16 y;
} Cell;

static Cell snake[MAX_SNAKE];
static const Cell food_path[] = {
    {12, 7},
    {4, 4},
    {16, 11},
    {8, 12},
    {18, 3},
};

static Cell food;
static u8 snake_len;
static u8 food_index;
static u8 score;
static s16 dir_x;
static s16 dir_y;
static s16 next_dir_x;
static s16 next_dir_y;
static u16 frame_counter;
static u16 previous_joy;
static bool game_over;

static void draw_at(s16 x, s16 y, const char *text)
{
    VDP_drawText(text, (u16)x, (u16)y);
}

static void draw_cell(Cell cell, const char *text)
{
    draw_at(BOARD_X + cell.x, BOARD_Y + cell.y, text);
}

static void draw_border(void)
{
    for (s16 x = 0; x < BOARD_W + 2; x++)
    {
        draw_at(BOARD_X - 1 + x, BOARD_Y - 1, "#");
        draw_at(BOARD_X - 1 + x, BOARD_Y + BOARD_H, "#");
    }

    for (s16 y = 0; y < BOARD_H; y++)
    {
        draw_at(BOARD_X - 1, BOARD_Y + y, "#");
        draw_at(BOARD_X + BOARD_W, BOARD_Y + y, "#");
    }
}

static void draw_score(void)
{
    char text[] = "SCORE 00";
    text[6] = (char)('0' + ((score / 10) % 10));
    text[7] = (char)('0' + (score % 10));
    draw_at(BOARD_X, 2, text);
}

static void place_food(void)
{
    food = food_path[food_index % (sizeof(food_path) / sizeof(food_path[0]))];
    food_index++;
    draw_cell(food, "*");
}

static void draw_snake(void)
{
    for (u8 i = 0; i < snake_len; i++)
    {
        draw_cell(snake[i], i == 0 ? "O" : "o");
    }
}

static void reset_game(void)
{
    VDP_clearPlane(BG_A, TRUE);

    draw_at(BOARD_X, 1, "DRIVE16 SNAKE");
    draw_at(BOARD_X, 25, "D-PAD MOVE  START RESET");
    draw_border();

    snake_len = START_SNAKE;
    snake[0].x = BOARD_W / 2;
    snake[0].y = BOARD_H / 2;
    snake[1].x = snake[0].x - 1;
    snake[1].y = snake[0].y;
    snake[2].x = snake[0].x - 2;
    snake[2].y = snake[0].y;

    dir_x = 0;
    dir_y = 0;
    next_dir_x = 0;
    next_dir_y = 0;
    frame_counter = 0;
    score = 0;
    food_index = 0;
    game_over = FALSE;

    draw_score();
    draw_snake();
    place_food();
}

static bool hits_snake(Cell head)
{
    for (u8 i = 0; i < snake_len; i++)
    {
        if (snake[i].x == head.x && snake[i].y == head.y)
        {
            return TRUE;
        }
    }
    return FALSE;
}

static void end_game(void)
{
    game_over = TRUE;
    draw_at(BOARD_X + 5, BOARD_Y + 7, "GAME OVER");
    draw_at(BOARD_X + 4, BOARD_Y + 9, "PRESS START");
}

static void step_game(void)
{
    if (dir_x == 0 && dir_y == 0)
    {
        return;
    }

    Cell head = snake[0];
    head.x += dir_x;
    head.y += dir_y;

    if (head.x < 0 || head.x >= BOARD_W || head.y < 0 || head.y >= BOARD_H || hits_snake(head))
    {
        end_game();
        return;
    }

    const bool ate_food = head.x == food.x && head.y == food.y;
    if (!ate_food)
    {
        draw_cell(snake[snake_len - 1], " ");
    }
    else if (snake_len < MAX_SNAKE)
    {
        snake_len++;
    }

    for (s16 i = (s16)snake_len - 1; i > 0; i--)
    {
        snake[i] = snake[i - 1];
    }

    snake[0] = head;
    draw_cell(snake[1], "o");
    draw_cell(snake[0], "O");

    if (ate_food)
    {
        score++;
        draw_score();
        place_food();
    }
}

static void read_input(void)
{
    const u16 joy = JOY_readJoypad(JOY_1);

    if ((joy & BUTTON_START) && !(previous_joy & BUTTON_START))
    {
        reset_game();
    }

    if (!game_over)
    {
        if ((joy & BUTTON_LEFT) && dir_x != 1)
        {
            next_dir_x = -1;
            next_dir_y = 0;
        }
        else if ((joy & BUTTON_RIGHT) && dir_x != -1)
        {
            next_dir_x = 1;
            next_dir_y = 0;
        }
        else if ((joy & BUTTON_UP) && dir_y != 1)
        {
            next_dir_x = 0;
            next_dir_y = -1;
        }
        else if ((joy & BUTTON_DOWN) && dir_y != -1)
        {
            next_dir_x = 0;
            next_dir_y = 1;
        }
    }

    previous_joy = joy;
}

int main(bool hardReset)
{
    (void)hardReset;

    VDP_setScreenWidth320();
    PAL_setColor(0, RGB24_TO_VDPCOLOR(0x102050));
    VDP_setBackgroundColor(0);
    JOY_init();
    XGM_startPlay(snake_loop);

    reset_game();

    while (TRUE)
    {
        read_input();

        if (!game_over)
        {
            frame_counter++;
            if (frame_counter >= MOVE_FRAMES)
            {
                frame_counter = 0;
                dir_x = next_dir_x;
                dir_y = next_dir_y;
                step_game();
            }
        }

        SYS_doVBlankProcess();
    }

    return 0;
}
