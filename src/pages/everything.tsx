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
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import { range } from "fp-ts/NonEmptyArray";
import { BehaviorSubject, Subject } from "rxjs";
import { three2 } from "../three2";
import { three3 } from "../three3";
const id = "everything";
const defaultWidth = 1024;
const defaultHeight = 1024;
const maxDepth = 5;
const depthRx = new Subject<number>();
const screenSizeRx = new Subject<[number, number]>();
const enableRx = new BehaviorSubject<boolean>(true);
const mouseRx = new Subject<[number, number]>();
export default function Everything() {
  useEffect(() => {
    // three(id, defaultWidth, defaultHeight, depthRx, screenSizeRx, enableRx);
    // three2(id, defaultWidth, defaultHeight, mouseRx);
    three3(id, defaultWidth, defaultHeight, mouseRx);
  }, []);
  const [width, setWidth] = useState(defaultWidth);
  const [height, setHeight] = useState(defaultHeight);
  return (
    <div>
      <Stack spacing={3}>
        <FormControlLabel
          control={
            <Checkbox
              defaultChecked
              onChange={(e) => enableRx.next(e.target.checked)}
            />
          }
          label="Enabled"
        />
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
            backgroundColor: "pink",
            position: "relative",
          }}
        >
          <div
            style={{
              backgroundColor: "magenta",
              width,
              height,
              position: "relative",
              margin: 0,
              padding: 0,
            }}
          >
            <div
              id={id}
              style={{
                backgroundColor: "blue",
                width,
                height,
                margin: 0,
                padding: 0,
              }}
              onMouseUp={(evt) => {
                var bounds = (evt.target as any).getBoundingClientRect();

                const x = ((evt.clientX - bounds.left) / width) * 2 - 1;
                const y = -((evt.clientY - bounds.top) / height) * 2 + 1;
                // console.log(x, y);
                mouseRx.next([x, y]);
              }}
            />
          </div>
        </Box>
      </Stack>
    </div>
  );
}
