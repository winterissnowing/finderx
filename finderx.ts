import { finder as finderLib } from "@medv/finder";

export type Options = {
  root: Element;
  idName: (name: string) => boolean;
  className: (name: string) => boolean;
  tagName: (name: string) => boolean;
  attr: (name: string, value: string) => boolean;
  seedMinLength: number;
  optimizedMinLength: number;
  threshold: number;
  maxNumberOfTries: number;
};

export type XNode = {
  //selectors list order : mix,idname,className,tagName
  selectors: string[];
  depth: number;
  parentNode?: XNode | null;
};

export type XData = {
  node: XNode;
};

export type XResult = {
  maxDepth: number;
  failedDepth: number;
  success: boolean;
};

const finderAttrs = [
  "data-for",
  "data-id",
  "data-testid",
  "data-test-id",
  "for",
  "id",
  "name",
  "placeholder",
  "role",
];

const defaultConfig = {
  idName: (name: string) => false,
  className: (name: string) => false,
  tagName: (name: string) => false,
  attr: (name: string, value: string) => false,
  seedMinLength: 1,
  optimizedMinLength: 2,
  threshold: 1000,
  maxNumberOfTries: 10_000,
};

const finderConfigs = [
  {
    ...defaultConfig,
    tagName: (name: string) => true,
    className: (name: string) => true,
    attr: (name: string) => finderAttrs.includes(name),
  },
  {
    ...defaultConfig,
    tagName: (name: string) => true,
    className: (name: string) => true,
  },
  {
    ...defaultConfig,
    tagName: (name: string) => true,
  },
  {
    ...defaultConfig,
    tagName: (name: string) => true,
    attr: (name: string) => finderAttrs.includes(name),
  },
];

finderAttrs.forEach((attr) => {
  finderConfigs.push({
    ...defaultConfig,
    tagName: (name: string) => true,
    attr: (name: string, value) => name == attr,
  });
});

function getMaxDepth(node: XNode): number {
  if (node.parentNode) {
    return getMaxDepth(node.parentNode);
  }
  return node.depth;
}

function queryNodeListBySelectors(
  selectors: string[],
  rootDocument: Element | Document,
  removeRepeat: boolean = true
): Element[] {
  const nodes: Element[] = [];
  for (const s of selectors) {
    const els = rootDocument.querySelectorAll(s);
    if (els && els.length > 0) {
      nodes.push(...Array.from(els));
    }
  }
  return removeRepeat ? [...new Set(nodes)] : nodes;
}

function findMostRecurringNode(nodes: Element[]): Element {
  const m = new Map();
  let finalNode: Element = nodes[0];
  let count = 0;
  nodes.forEach((node) => {
    const i = m.get(node) ? m.get(node) + 1 : 1;
    m.set(node, i);
  });

  m.forEach((value, key) => {
    if (value > count) {
      count = value;
      finalNode = key;
    }
  });
  return finalNode;
}

function compareParentNode(
  node: XNode,
  el: Element,
  rootDocument: Element | Document
): XResult {
  let nodeParentNode = node.parentNode;
  let elParentElement = el.parentElement;
  const maxDepth = getMaxDepth(node);
  const xresult: XResult = {
    maxDepth,
    failedDepth: 0,
    success: true,
  };
  while (nodeParentNode && elParentElement) {
    if (elParentElement == rootDocument) {
      break;
    }
    if (
      elParentElement == document.body ||
      elParentElement == document.documentElement ||
      elParentElement.parentElement == document.body
    ) {
      break;
    }
    const parentNodes = queryNodeListBySelectors(
      nodeParentNode.selectors,
      rootDocument
    );

    if (
      !parentNodes ||
      parentNodes.length == 0 ||
      !parentNodes.includes(elParentElement)
    ) {
      xresult.failedDepth = nodeParentNode.depth;
      xresult.success = false;
    }
    nodeParentNode = nodeParentNode.parentNode;
    elParentElement = elParentElement.parentElement;
  }
  return xresult;
}

function queryElementSelectors(input: Element) {
  const classes = Array.from(input.classList);
  const selectors: string[] = [];
  const configs = [...finderConfigs];
  classes.forEach((className) => {
    configs.push({
      ...defaultConfig,
      className: (name) => {
        if (classes.filter((cn) => cn != className).includes(name)) {
          return false;
        } else {
          return true;
        }
      },
    });
  });
  try {
    configs.forEach((cfg) => {
      selectors.push(finder(input, cfg));
    });
  } catch (error) {
    return selectors;
  }
  return [...new Set(selectors)];
}

function parseSelectorsTree(
  input: Element,
  node: XNode | null,
  depth: number = 0
): XNode | null {
  const selectors = queryElementSelectors(input);
  if (selectors.length == 0) {
    return node;
  }
  const xnode: XNode = {
    selectors,
    depth,
  };
  if (node == null) {
    node = xnode;
    if (input.parentElement) {
      parseSelectorsTree(input.parentElement, node, ++depth);
    }
  } else {
    node.parentNode = xnode;
    if (input.parentElement) {
      parseSelectorsTree(input.parentElement, node.parentNode, ++depth);
    }
  }
  return node;
}

export function finder(input: Element, options?: Partial<Options>) {
  return finderLib(input, options);
}

export function parserX(input: Element): XNode | null {
  return parseSelectorsTree(input, null);
}

export function finderX(
  node: XNode,
  root: Element | Document,
  precision: number
) {
  if (!node || node.selectors.length == 0) {
    return null;
  }
  const rootDocument = root || document;
  const els: Element[] = [];
  const nodeList = queryNodeListBySelectors(node.selectors, rootDocument, false);
  if (!nodeList || nodeList.length == 0) {
    return null;
  }
  if ([...new Set(els)].length != els.length ) {
    const el = findMostRecurringNode(els)
    els.push(el)
  } else {
    els.push(...nodeList)
  }

  let maxFailedDepthRet: XResult | null = null;
  let maxFailedDepthEl: Element | null = null;
  for (const el of els) {
    const ret = compareParentNode(node, el, rootDocument);
    if (ret.success) {
      return el;
    }
    if (!maxFailedDepthRet) {
      maxFailedDepthRet = ret;
    }
    if (ret.failedDepth > maxFailedDepthRet.failedDepth) {
      maxFailedDepthRet = ret;
      maxFailedDepthEl = el;
    }
  }
  if (maxFailedDepthRet && maxFailedDepthEl) {
    const { failedDepth, maxDepth } = maxFailedDepthRet;
    const rate = ((failedDepth - 1) / maxDepth) * 10;
    if (rate >= precision) {
      return maxFailedDepthEl;
    }
  }
  return null;
}
