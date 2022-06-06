import * as React from "react";
import { useEffect, useState } from "react";
import { three } from "../three";
import {
  Slider,
  Box,
  Typography,
  Stack,
  TextField,
  Button,
} from "@mui/material";
import { range } from "fp-ts/NonEmptyArray";
import { Subject } from "rxjs";
const id = "everything";
const defaultWidth = 1024;
const defaultHeight = 1024;
const maxDepth = 5;
const depthRx = new Subject<number>();
const screenSizeRx = new Subject<[number, number]>();
export default function Everything() {
  useEffect(() => {
    three(id, defaultWidth, defaultHeight, depthRx, screenSizeRx);
  }, []);
  const [width, setWidth] = useState(defaultWidth);
  const [height, setHeight] = useState(defaultHeight);
  return (
    <div>
      <Stack spacing={3}>
        <Typography>Depth</Typography>
        <Slider
          aria-label="Temperature"
          defaultValue={3}
          getAriaValueText={(n) => n.toString()}
          valueLabelDisplay="auto"
          step={1}
          min={1}
          max={maxDepth}
          marks={range(1, maxDepth).map((n) => ({
            value: n,
            label: n.toString(),
          }))}
          onChange={(_, v) => depthRx.next(v as number)}
        />
        <Stack direction="row" spacing={1}>
          <TextField
            label="Width"
            type="number"
            defaultValue={width}
            onChange={(x) => setWidth(Number.parseInt(x.target.value))}
          />
          <TextField
            label="Height"
            type="number"
            defaultValue={height}
            onChange={(x) => setHeight(Number.parseInt(x.target.value))}
          />
          <Button onClick={() => screenSizeRx.next([width, height])}>
            Change
          </Button>
        </Stack>
        <Box
          sx={{
            width: defaultWidth,
            height: defaultHeight,
            backgroundColor: "black",
          }}
        >
          <div id={id} />
        </Box>
      </Stack>
    </div>
  );
}
