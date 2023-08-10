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
  nextElementSelectors: string[];
  previousElementSelectors: string[];
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
  },
  {
    ...defaultConfig,
    idName: (name: string) => true,
  },
  {
    ...defaultConfig,
    tagName: (name: string) => true,
    attr: (name: string) => finderAttrs.includes(name),
  },
  {
    ...defaultConfig,
    className: (name: string) => true,
    attr: (name: string) => finderAttrs.includes(name),
  },
  {
    ...defaultConfig,
    tagName: (name: string) => true,
    idName: (name: string) => true,
    className: (name: string) => true,
    attr: (name: string) => false,
  },
  {
    ...defaultConfig,
    tagName: (name: string) => true,
    idName: (name: string) => true,
    className: (name: string) => true,
    attr: (name: string) => finderAttrs.includes(name),
  },
];

// finderAttrs.forEach((attr) => {
//   finderConfigs.push({
//     ...defaultConfig,
//     tagName: (name: string) => true,
//     attr: (name: string, value) => name == attr,
//   });
// });

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
  if (!selectors) {
    return nodes;
  }
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
  rootDocument: Element | Document,
  isCompareSibings: boolean = false
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
    const isMatchSibings = isCompareSibings
      ? compareSibingsNode(nodeParentNode, elParentElement, rootDocument)
      : true;

    if (
      !parentNodes ||
      parentNodes.length == 0 ||
      !parentNodes.includes(elParentElement) ||
      !isMatchSibings
    ) {
      xresult.failedDepth = nodeParentNode.depth;
      xresult.success = false;
    }
    nodeParentNode = nodeParentNode.parentNode;
    elParentElement = elParentElement.parentElement;
  }
  return xresult;
}

function compareSibingsNode(
  node: XNode,
  el: Element,
  rootDocument: Element | Document
) {
  let isMatchNext = true;
  let isMatchPrevious = true;
  const { previousElementSelectors, nextElementSelectors } = node;
  if (nextElementSelectors && nextElementSelectors.length > 0) {
    const nextElementSiblings = queryNodeListBySelectors(
      nextElementSelectors,
      rootDocument
    );
    isMatchNext = (el.nextElementSibling &&
      nextElementSiblings.includes(el.nextElementSibling)) as boolean;
  }
  if (previousElementSelectors && previousElementSelectors.length > 0) {
    const previousElementSiblings = queryNodeListBySelectors(
      previousElementSelectors,
      rootDocument
    );
    isMatchPrevious = (el.previousElementSibling &&
      previousElementSiblings.includes(el.previousElementSibling)) as boolean;
  }
  return isMatchNext && isMatchPrevious;
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
    previousElementSelectors: [],
    nextElementSelectors: [],
    selectors,
    depth,
  };
  if (input.previousElementSibling) {
    xnode.previousElementSelectors = queryElementSelectors(
      input.previousElementSibling
    );
  }
  if (input.nextElementSibling) {
    xnode.nextElementSelectors = queryElementSelectors(
      input.nextElementSibling
    );
  }
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

function finderMostPrecisionElement(
  elements: Element[],
  node: XNode,
  rootDocument: Element | Document,
  precision: number
): Element | null {
  const successEls = [];
  let failedData = {
    el: null as Element | null,
    failedDepth: 0 as number,
    maxDepth: 0 as number,
  };
  for (const el of elements) {
    const { success, failedDepth, maxDepth } = compareParentNode(
      node,
      el,
      rootDocument
    );
    if (success) {
      successEls.push(el);
    } else if (!failedData.el || failedDepth > failedData.failedDepth) {
      failedData = { el, failedDepth, maxDepth };
    }
  }
  if (successEls.length == 1) {
    return successEls[0];
  }
  if (successEls.length > 1) {
    //need double check el siblings element
    let tempEl: Element = successEls[0];
    let tempFailedDepth = 0;
    for (const el of successEls) {
      const { success, failedDepth } = compareParentNode(
        node,
        el,
        rootDocument,
        true
      );
      if (success) {
        return el;
      } else if (failedDepth > tempFailedDepth) {
        tempFailedDepth = failedDepth;
        tempEl = el;
      }
    }
    return tempEl;
  }
  if (failedData.el) {
    const { failedDepth, maxDepth, el } = failedData;
    const rate = ((failedDepth - 1) / maxDepth) * 10;
    if (rate >= precision) {
      return el;
    }
  }
  return null;
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
  precision: number = 10
) {
  if (!node || node.selectors.length == 0) {
    return null;
  }
  const rootDocument = root || document;
  const elements: Element[] = [];
  const nodeList = queryNodeListBySelectors(
    node.selectors,
    rootDocument,
    false
  );
  if (!nodeList || nodeList.length == 0) {
    return null;
  }
  if ([...new Set(nodeList)].length != nodeList.length) {
    const el = findMostRecurringNode(nodeList);
    elements.push(el);
  } else {
    elements.push(...nodeList);
  }

  return finderMostPrecisionElement(elements, node, rootDocument, precision);
}
