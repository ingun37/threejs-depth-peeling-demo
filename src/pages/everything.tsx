import * as React from "react";
import { useEffect } from "react";
import { three } from "../three";
const id = "everything";
export default function Everything() {
  useEffect(() => {
    three(id, 1024, 1024);
  }, []);
  return <div id={id} />;
}
