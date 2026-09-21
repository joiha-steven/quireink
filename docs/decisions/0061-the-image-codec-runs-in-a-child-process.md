# 0061 — The image codec runs in a child process, one per variant

Date: 2026-09-21
Status: accepted
In force: see the [index](README.md). The index is maintained; this file is not.

## The problem

A blog of 33 posts and 18 pictures, in a container limited to 128 MB, was killed by the kernel
two minutes after a boot that had looked perfectly healthy. 160 MB was killed. 192 MB was
killed. 256 MB finished. Two minutes is when the first full tick runs, and what it runs is the
image variant sweep.

Serving is not what needs that memory. The same instance answers a page in 5 to 37 ms on a
QUARTER of a CPU and sits at 56 MB doing it. The floor was set entirely by making the smaller
copies of an uploaded picture.

**libvips does not hand memory back.** Measured 2026-09-21 in a container, six variants from
one 2048px photograph in a single process:

| after | resident |
|---|---|
| bun + sharp loaded | 51 MB |
| three WebP copies | 66 MB |
| the 1024px AVIF | 106 MB |
| the 1600px AVIF | **136 MB** |

and it stays at 136. In a server that runs for months, that climb is permanent, it lands on top
of everything the server already holds, and the sum is what the kernel reads.

Four cheaper answers were measured first, and all four failed:

| tried | result |
|---|---|
| `sequentialRead: true` | 171.7 MB, **worse** than the 140.1 MB baseline |
| `VIPS_DISC_THRESHOLD=10m` | 141.1 MB, no change |
| a file path instead of a Buffer | 138.0 MB, 2 MB |
| `sharp.concurrency(1)` | ⚠️ a no-op: libvips already reports concurrency 1 inside a container, at `--cpus=0.25`, `--cpuset-cpus=0` and `--cpus=1` alike |

Lowering the AVIF effort is a real saving of CPU and is taken separately (`image.ts`), but it
does not move this: at effort 2 the same instance was still killed at 128, 160 and 192 MB.

## The decision

**Every display variant is encoded in a process of its own** (`src/media/encode-variant.ts`),
spawned by `makeDisplay`, fed the original on stdin and answering with the encoded bytes on
stdout. It exits, and the operating system takes back everything libvips was holding.

The parent never loads the codec on this path at all. The child is told a width and a format
and nothing else — the `Math.min(width, originalWidth)` that used to sit in the resize needed
the original's dimensions, and reading those in the parent would load sharp there and undo the
whole arrangement. It was redundant in any case: `withoutEnlargement` already keeps a 900px
source at 900px for every larger size, which `image.test.ts` holds.

**There is no fallback to encoding in the server**, and that is the decision rather than an
omission. A child that exits non-zero has usually been KILLED, and answering that by doing the
same work in the parent is how the failure this exists to prevent arrives anyway. `finalize.ts`
already selects on `variants < VARIANT_VERSION`, so a variant that failed is simply still
pending on the next tick.

Spawning is not a new requirement: `server/backup.ts` has spawned `tar` since the port, so an
installation that cannot start a child process already cannot take a backup.

## What it bought

Measured on the same fixture and the same quarter of a CPU:

| | before | after |
|---|---|---|
| the floor | 256 MB | **192 MB** |
| at 192 MB | OOM-killed | runs, 90 to 93 MB steady |
| container high-water, six variants | 110 MB | 83 MB |
| six variants | 1,708 ms | 1,821 ms |

**And the failure changed shape, which matters more than the 64 MB.** One of three runs at
192 MB still hit the limit — and the log reads

```
[ERROR] tick finalize: encode 1600.avif exited null (SIGKILL)
```

while `/api/health` answered 200 with the database and the store both fine, and all eighteen
media rows were still `variants = 0`, waiting for the next tick. The kernel killed the encoder
and the blog stayed up. Before this, the same pressure killed the server itself, and left
nothing in the log to say why.

## The cost, stated

One Bun start per variant: **113 ms over six of them**, 6.6%. It is spent on the maintenance
tick, never on a request, so nobody is waiting for it.

## What this does not fix

`makeThumb`, `capOriginal` and `imageSize` still run in the server, on the upload path, so a
server that has accepted a picture since it booted is still holding the codec. Those are small
— a 400px WebP — and they are on a request, where a child's startup would be felt. The sweep
was the one that killed installations, and the sweep is what moved.

**128 MB with pictures is still out of reach**, and the arithmetic says why rather than the
measurement alone: Bun with sharp loaded is 50 MB before any work, one 1600px AVIF encode peaks
at 111 MB in a fresh process, and the server is 56 MB. There is nothing left to give without
changing what readers receive.
