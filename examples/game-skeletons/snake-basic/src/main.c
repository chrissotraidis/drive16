#include <genesis.h>
#include "resources.h"

#define BOARD_X 6
#define BOARD_Y 5
#define BOARD_W 20
#define BOARD_H 18
#define MAX_SNAKE 48
#define START_SNAKE 3
#define MOVE_FRAMES 24
#define TILE_SOLID TILE_USER_INDEX
#define TILE_INSET (TILE_USER_INDEX + 1)
#define TILE_GRID (TILE_USER_INDEX + 2)

static const u32 presentation_tiles[24] = {
    0x11111111, 0x11111111, 0x11111111, 0x11111111,
    0x11111111, 0x11111111, 0x11111111, 0x11111111,
    0x11111111, 0x12222221, 0x12222221, 0x12222221,
    0x12222221, 0x12222221, 0x12222221, 0x11111111,
    0x10000001, 0x00000000, 0x00011000, 0x00011000,
    0x00000000, 0x00000000, 0x10000001, 0x00000000,
};

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
static bool started;
static bool paused;
static bool game_over;

static void draw_at(s16 x, s16 y, const char *text)
{
    VDP_drawText(text, (u16)x, (u16)y);
}

static void draw_at_palette(s16 x, s16 y, const char *text, u16 palette)
{
    VDP_setTextPalette(palette);
    draw_at(x, y, text);
    VDP_setTextPalette(PAL3);
}

static u16 art_tile(u16 palette, u16 tile)
{
    return TILE_ATTR_FULL(palette, FALSE, FALSE, FALSE, tile);
}

static void draw_cell(Cell cell, u16 palette, u16 tile)
{
    VDP_setTileMapXY(BG_A, art_tile(palette, tile), (u16)(BOARD_X + cell.x), (u16)(BOARD_Y + cell.y));
}

static void clear_cell(Cell cell)
{
    VDP_setTileMapXY(BG_A, 0, (u16)(BOARD_X + cell.x), (u16)(BOARD_Y + cell.y));
}

static void draw_border(void)
{
    VDP_fillTileMapRect(BG_B, art_tile(PAL1, TILE_GRID), BOARD_X, BOARD_Y, BOARD_W, BOARD_H);
    VDP_fillTileMapRect(BG_A, art_tile(PAL3, TILE_SOLID), BOARD_X - 1, BOARD_Y - 1, BOARD_W + 2, 1);
    VDP_fillTileMapRect(BG_A, art_tile(PAL3, TILE_SOLID), BOARD_X - 1, BOARD_Y + BOARD_H, BOARD_W + 2, 1);
    VDP_fillTileMapRect(BG_A, art_tile(PAL3, TILE_SOLID), BOARD_X - 1, BOARD_Y, 1, BOARD_H);
    VDP_fillTileMapRect(BG_A, art_tile(PAL3, TILE_SOLID), BOARD_X + BOARD_W, BOARD_Y, 1, BOARD_H);
}

static void draw_score(void)
{
    char text[] = "SCORE 00";
    text[6] = (char)('0' + ((score / 10) % 10));
    text[7] = (char)('0' + (score % 10));
    draw_at(BOARD_X, 2, text);
}

static void draw_title(void)
{
    VDP_fillTileMapRect(BG_A, 0, BOARD_X, BOARD_Y, BOARD_W, BOARD_H);
    VDP_fillTileMapRect(BG_A, art_tile(PAL1, TILE_INSET), BOARD_X + 3, BOARD_Y + 3, 5, 1);
    VDP_fillTileMapRect(BG_A, art_tile(PAL2, TILE_INSET), BOARD_X + 12, BOARD_Y + 3, 5, 1);
    draw_at_palette(BOARD_X + 7, BOARD_Y + 5, "SNAKE", PAL1);
    draw_at(BOARD_X + 4, BOARD_Y + 8, "EAT FOOD, GROW");
    draw_at_palette(BOARD_X + 4, BOARD_Y + 11, "PRESS START", PAL2);
}

static void place_food(void)
{
    food = food_path[food_index % (sizeof(food_path) / sizeof(food_path[0]))];
    food_index++;
    draw_cell(food, PAL2, TILE_INSET);
}

static void draw_snake(void)
{
    for (u8 i = 0; i < snake_len; i++)
    {
        draw_cell(snake[i], PAL1, i == 0 ? TILE_INSET : TILE_SOLID);
    }
}

static void reset_game(void)
{
    VDP_clearPlane(BG_A, TRUE);
    VDP_clearPlane(BG_B, TRUE);
    VDP_fillTileMapRect(BG_B, art_tile(PAL3, TILE_SOLID), 0, 0, 40, 4);
    VDP_fillTileMapRect(BG_B, art_tile(PAL3, TILE_SOLID), 0, 24, 40, 4);
    draw_at(BOARD_X, 1, "DRIVE16 // SNAKE");
    draw_at(BOARD_X - 2, 25, "D-PAD MOVE  C PAUSE  START RESET");
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
    paused = FALSE;

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
        clear_cell(snake[snake_len - 1]);
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
    draw_cell(snake[1], PAL1, TILE_SOLID);
    draw_cell(snake[0], PAL1, TILE_INSET);

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
    const u16 pressed = joy & (u16)~previous_joy;

    if (!started)
    {
        if (pressed & BUTTON_START)
        {
            started = TRUE;
            reset_game();
        }
        previous_joy = joy;
        return;
    }

    if ((pressed & BUTTON_C) && !game_over)
    {
        paused = !paused;
        if (paused) draw_at(BOARD_X + 7, BOARD_Y + 8, "PAUSED");
        else
        {
            VDP_fillTileMapRect(BG_A, 0, BOARD_X, BOARD_Y, BOARD_W, BOARD_H);
            draw_snake();
            draw_cell(food, PAL2, TILE_INSET);
        }
    }

    if (pressed & BUTTON_START)
    {
        reset_game();
    }

    if (!game_over && !paused)
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
    PAL_setColor(0, RGB24_TO_VDPCOLOR(0x102818));
    PAL_setColor(17, RGB24_TO_VDPCOLOR(0x2A6B46));
    PAL_setColor(18, RGB24_TO_VDPCOLOR(0x153E2A));
    PAL_setColor(31, RGB24_TO_VDPCOLOR(0x8DFF9F));
    PAL_setColor(33, RGB24_TO_VDPCOLOR(0xFFB23E));
    PAL_setColor(34, RGB24_TO_VDPCOLOR(0xFF5E45));
    PAL_setColor(47, RGB24_TO_VDPCOLOR(0xFFF1A8));
    PAL_setColor(49, RGB24_TO_VDPCOLOR(0x247C8C));
    PAL_setColor(50, RGB24_TO_VDPCOLOR(0x163E58));
    PAL_setColor(63, RGB24_TO_VDPCOLOR(0xE7FBFF));
    VDP_setBackgroundColor(0);
    VDP_loadTileData(presentation_tiles, TILE_SOLID, 3, CPU);
    VDP_setTextPalette(PAL3);
    JOY_init();
    XGM_startPlay(snake_loop);

    reset_game();
    started = FALSE;
    draw_title();

    while (TRUE)
    {
        read_input();

        if (started && !paused && !game_over)
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
