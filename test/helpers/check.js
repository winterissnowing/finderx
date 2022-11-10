import { finder, finderX, parserX } from "../../finderx.js";

export default function check(t, html, config = void 0) {
  document.write(html);

  const list = [];

  for (let node of document.querySelectorAll("*")) {
    const css = finder(node, config);
    const xnode = parserX(node, document);
    //console.log(xnode);

    t.is(
      document.querySelectorAll(css).length,
      1,
      `Selector "${css}" selects more then one node.`
    );
    t.is(
      document.querySelector(css),
      node,
      `Selector "${css}" selects another node.`
    );
    for (let se of xnode.selectors) {
      t.is(
        document.querySelector(se),
        node,
        `Selector "${css}" failed excute parserX ! .`
      );
    }
    t.is(
      finderX(xnode),
      node,
      `Selector "${css}" failed excute finderX.`
    );

    list.push(css);
  }

  t.snapshot(list.join("\n"));


  document.clear();
}
