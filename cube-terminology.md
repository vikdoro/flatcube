# Cube terminology

Terms used for the board and its controls.

## The board

- **Middle face**: the face in the middle of the board. On the board it is always called **D**.
- **Lid**: the face hanging open above the board, hinged on its top edge. Always called **U**.
- **Sides**: the four faces fanned out around the middle face: **B** at the top of the page, **F** at the bottom,
  **L** on the left and **R** on the right. Each side has three rows:
  - **Inner row**: next to the middle face.
  - **Middle row**: between the other two.
  - **Rim row**: the outer edge of the board.
- **Rings**: the two moves that go round all four sides:
  - **D ring** (the middle face's ring): the inner rows.
  - **U ring** (the lid's ring): the rim rows.
  - The middle row can't turn on its own, so it is split down the middle (`RING_CUT`): the inner half goes to the
    D ring and the outer half to the U ring.
- **Seam**: the diagonal line where two sides meet at a corner of the fan.

## Sticker names

A sticker is named by its face and a number from 1 to 9, in reading order as the face is seen from inside the cube,
with the cube held as at the start (see `START_NAMES` in `src/vue/CubeBoard.vue`). Each side is read with its
rim up, so its rim row is 1 2 3 and its inner row is 7 8 9.

The names belong to the stickers, not to places on the board, so they move with the stickers when the cube turns.

## Seam stickers

**Seam stickers** are the side stickers in the column next to a seam. Each one is controlled by two moves:

- a **ring**: D for the inner row, U for the rim row, and either one for the middle row, depending on which side of
  `RING_CUT` the press lands;
- the **straight turn** of the neighbouring side, which moves them across the rows, towards or away from the middle
  face.

Across a seam, the two sides run at right angles. That makes one sticker's ring direction the same as the straight
direction of the sticker on the other side of the seam. For example, at the top-left corner:

- **L1** goes up and down for the U ring, and left and right for B.
- **B3** goes left and right for the U ring, and up and down for L.

A finger pressed near the seam reaches both stickers, so an up-and-down drag there could mean U (through L1) or
L (through B3). The controls overlap.

To settle it, a press on or near a seam sticker **favours the ring** (`SEAM_RING_BONUS` in `src/board/gestures.ts`).
The straight turn only wins when the drag runs within about 30° of its direction.

### Corner seam stickers

There are 16, four per corner: the inner and rim corners of the two sides that meet there.

| Corner | Rim row (U ring) | Inner row (D ring) |
|---|---|---|
| Top-left (L/B) | L1 (+B), B3 (+L) | L7 (+B), B9 (+L) |
| Top-right (B/R) | B1 (+R), R3 (+B) | B7 (+R), R9 (+B) |
| Bottom-right (R/F) | R1 (+F), F3 (+R) | R7 (+F), F9 (+R) |
| Bottom-left (F/L) | F1 (+L), L3 (+F) | F7 (+L), L9 (+F) |

The move in brackets is the straight turn the sticker also belongs to.

### Middle seam stickers

There are 8: the middle-row edges next to a seam. They have the same overlap, but their ring is split between U
and D at `RING_CUT`.

| Corner | Middle row (U/D split) |
|---|---|
| Top-left (L/B) | L4 (+B), B6 (+L) |
| Top-right (B/R) | B4 (+R), R6 (+B) |
| Bottom-right (R/F) | R4 (+F), F6 (+R) |
| Bottom-left (F/L) | F4 (+L), L6 (+F) |
