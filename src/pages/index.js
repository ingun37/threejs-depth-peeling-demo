import * as React from "react";
import Everything from "./everything";

// styles
const pageStyles = {
  backgroundColor: "#000000",
  color: "#232129",
  padding: 96,
  fontFamily: "-apple-system, Roboto, sans-serif, serif",
};

// markup
const IndexPage = () => {
  return (
    <main style={pageStyles}>
      <Everything />
    </main>
  );
};

export default IndexPage;
