#include <genesis.h>
#include "resources.h"

#define FIELD_LEFT 2
#define FIELD_RIGHT 37
#define FIELD_TOP 5
#define FIELD_BOTTOM 23
#define MAX_ASTEROIDS 6
#define MAX_BULLETS 5
#define STEP_FRAMES 10

typedef struct
{
    s16 x;
    s16 y;
    s16 dx;
    s16 dy;
    bool active;
} GameObject;

static GameObject ship;
static GameObject asteroids[MAX_ASTEROIDS];
static GameObject bullets[MAX_BULLETS];
static u16 previous_joy;
static u16 frame_counter;
static u16 score;
static u8 lives;
static u8 direction;
static bool game_over;

static void draw_game(void);

static const s16 asteroid_starts[MAX_ASTEROIDS][4] = {
    {5, 7, 1, 0},
    {31, 8, -1, 1},
    {10, 19, 1, -1},
    {34, 20, -1, 0},
    {18, 6, 0, 1},
    {25, 17, 1, 1},
};

static void draw_with_palette(u16 palette, s16 x, s16 y, const char *text)
{
    VDP_setTextPalette(palette);
    VDP_drawText(text, (u16)x, (u16)y);
}

static void wrap(GameObject *object)
{
    if (object->x < FIELD_LEFT + 1) object->x = FIELD_RIGHT - 1;
    if (object->x > FIELD_RIGHT - 1) object->x = FIELD_LEFT + 1;
    if (object->y < FIELD_TOP + 1) object->y = FIELD_BOTTOM - 1;
    if (object->y > FIELD_BOTTOM - 1) object->y = FIELD_TOP + 1;
}

static void reset_game(void)
{
    ship.x = 20;
    ship.y = 14;
    ship.dx = 0;
    ship.dy = 0;
    ship.active = TRUE;
    direction = 0;
    score = 0;
    lives = 3;
    game_over = FALSE;
    frame_counter = 0;

    for (u8 i = 0; i < MAX_ASTEROIDS; i++)
    {
        asteroids[i].x = asteroid_starts[i][0];
        asteroids[i].y = asteroid_starts[i][1];
        asteroids[i].dx = asteroid_starts[i][2];
        asteroids[i].dy = asteroid_starts[i][3];
        asteroids[i].active = TRUE;
    }
    for (u8 i = 0; i < MAX_BULLETS; i++) bullets[i].active = FALSE;
}

static void fire_bullet(void)
{
    static const s16 direction_x[] = {0, 1, 0, -1};
    static const s16 direction_y[] = {-1, 0, 1, 0};

    for (u8 i = 0; i < MAX_BULLETS; i++)
    {
        if (!bullets[i].active)
        {
            bullets[i].x = ship.x;
            bullets[i].y = ship.y;
            bullets[i].dx = direction_x[direction];
            bullets[i].dy = direction_y[direction];
            bullets[i].active = TRUE;
            return;
        }
    }
}

static void read_input(void)
{
    const u16 joy = JOY_readJoypad(JOY_1);
    static const s16 direction_x[] = {0, 1, 0, -1};
    static const s16 direction_y[] = {-1, 0, 1, 0};

    if ((joy & BUTTON_START) && !(previous_joy & BUTTON_START))
    {
        reset_game();
        draw_game();
    }
    if (!game_over)
    {
        if ((joy & BUTTON_LEFT) && !(previous_joy & BUTTON_LEFT)) direction = (direction + 3) & 3;
        if ((joy & BUTTON_RIGHT) && !(previous_joy & BUTTON_RIGHT)) direction = (direction + 1) & 3;
        if ((joy & BUTTON_UP) && !(previous_joy & BUTTON_UP))
        {
            ship.dx = direction_x[direction];
            ship.dy = direction_y[direction];
        }
        if ((joy & BUTTON_A) && !(previous_joy & BUTTON_A)) fire_bullet();
    }
    previous_joy = joy;
}

static bool overlaps(const GameObject *left, const GameObject *right)
{
    return left->x == right->x && left->y == right->y;
}

static void step_game(void)
{
    ship.x += ship.dx;
    ship.y += ship.dy;
    wrap(&ship);
    ship.dx = 0;
    ship.dy = 0;

    for (u8 i = 0; i < MAX_ASTEROIDS; i++)
    {
        if (!asteroids[i].active) continue;
        asteroids[i].x += asteroids[i].dx;
        asteroids[i].y += asteroids[i].dy;
        wrap(&asteroids[i]);

        if (overlaps(&ship, &asteroids[i]))
        {
            if (lives > 0) lives--;
            ship.x = 20;
            ship.y = 14;
            if (lives == 0) game_over = TRUE;
        }
    }

    for (u8 bullet = 0; bullet < MAX_BULLETS; bullet++)
    {
        if (!bullets[bullet].active) continue;
        bullets[bullet].x += bullets[bullet].dx;
        bullets[bullet].y += bullets[bullet].dy;
        if (bullets[bullet].x <= FIELD_LEFT || bullets[bullet].x >= FIELD_RIGHT ||
            bullets[bullet].y <= FIELD_TOP || bullets[bullet].y >= FIELD_BOTTOM)
        {
            bullets[bullet].active = FALSE;
            continue;
        }

        for (u8 asteroid = 0; asteroid < MAX_ASTEROIDS; asteroid++)
        {
            if (asteroids[asteroid].active && overlaps(&bullets[bullet], &asteroids[asteroid]))
            {
                asteroids[asteroid].active = FALSE;
                bullets[bullet].active = FALSE;
                score += 10;
                break;
            }
        }
    }
}

static void draw_status(void)
{
    char score_text[] = "SCORE 0000";
    char lives_text[] = "LIVES 0";

    score_text[6] = (char)('0' + ((score / 1000) % 10));
    score_text[7] = (char)('0' + ((score / 100) % 10));
    score_text[8] = (char)('0' + ((score / 10) % 10));
    score_text[9] = (char)('0' + (score % 10));
    lives_text[6] = (char)('0' + lives);
    draw_with_palette(0, 3, 3, score_text);
    draw_with_palette(0, 30, 3, lives_text);
}

static void erase_objects(void)
{
    draw_with_palette(0, ship.x - 1, ship.y, "   ");
    for (u8 i = 0; i < MAX_ASTEROIDS; i++)
        if (asteroids[i].active) draw_with_palette(0, asteroids[i].x, asteroids[i].y, "  ");
    for (u8 i = 0; i < MAX_BULLETS; i++)
        if (bullets[i].active) draw_with_palette(0, bullets[i].x, bullets[i].y, " ");
}

static void draw_objects(void)
{
    static const char *ship_glyphs[] = {"<^>", "[>]", "<v>", "[<]"};

    draw_with_palette(1, 7, 10, ".");
    draw_with_palette(1, 14, 16, ".");
    draw_with_palette(1, 28, 12, ".");
    draw_with_palette(1, 33, 18, ".");
    for (u8 i = 0; i < MAX_ASTEROIDS; i++)
        if (asteroids[i].active) draw_with_palette(1, asteroids[i].x, asteroids[i].y, "OO");
    for (u8 i = 0; i < MAX_BULLETS; i++)
        if (bullets[i].active) draw_with_palette(2, bullets[i].x, bullets[i].y, "*");
    draw_with_palette(3, ship.x - 1, ship.y, ship_glyphs[direction]);

    if (game_over)
    {
        draw_with_palette(2, 15, 13, "GAME OVER");
        draw_with_palette(2, 14, 15, "PRESS START");
    }
}

static void draw_game(void)
{
    VDP_clearPlane(BG_A, TRUE);
    draw_with_palette(0, 0, 0, "        ");
    draw_with_palette(0, 11, 1, "DRIVE16 ASTEROIDS");

    for (s16 x = FIELD_LEFT; x <= FIELD_RIGHT; x++)
    {
        draw_with_palette(1, x, FIELD_TOP, "-");
        draw_with_palette(1, x, FIELD_BOTTOM, "-");
    }
    for (s16 y = FIELD_TOP + 1; y < FIELD_BOTTOM; y++)
    {
        draw_with_palette(1, FIELD_LEFT, y, "|");
        draw_with_palette(1, FIELD_RIGHT, y, "|");
    }

    draw_with_palette(0, 3, 26, "LEFT/RIGHT TURN  UP THRUST  A FIRE");
    draw_status();
    draw_objects();
}

int main(bool hardReset)
{
    (void)hardReset;
    VDP_setScreenWidth320();
    PAL_setColor(0, RGB24_TO_VDPCOLOR(0x081020));
    PAL_setColor(15, RGB24_TO_VDPCOLOR(0xF4F0DA));
    PAL_setColor(31, RGB24_TO_VDPCOLOR(0x8D95A8));
    PAL_setColor(47, RGB24_TO_VDPCOLOR(0xFFB24A));
    PAL_setColor(63, RGB24_TO_VDPCOLOR(0x63D7FF));
    VDP_setBackgroundColor(0);
    VDP_clearPlane(BG_A, TRUE);
    VDP_clearPlane(BG_B, TRUE);
    XGM_startPlay(asteroids_music);
    reset_game();
    draw_game();

    while (TRUE)
    {
        read_input();
        if (!game_over && ++frame_counter >= STEP_FRAMES)
        {
            frame_counter = 0;
            erase_objects();
            step_game();
            draw_status();
            draw_objects();
        }
        SYS_doVBlankProcess();
    }
    return 0;
}
