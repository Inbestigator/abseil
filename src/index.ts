/** biome-ignore-all lint/suspicious/noExplicitAny: Not worth my time */
import {
  type APIComponentInContainer,
  type APIComponentInMessageActionRow,
  type APIMessageComponent,
  type APISectionAccessoryComponent,
  type APISelectMenuComponent,
  ComponentType,
} from "discord-api-types/v10";

type CT = Omit<typeof ComponentType, "SelectMenu"> & {
  "Button:URL": ComponentType.Button;
  "Button:SKU": ComponentType.Button;
};
type IComponentType = { [K in keyof CT as CT[K]]: K };
type WithCustomIdType = Exclude<
  IComponentType[Extract<APIMessageComponent, { custom_id: string }>["type"]],
  `Button:${string}`
>;

type Pop<T extends any[]> = T extends [...infer Rest, any] ? Rest : never;
type Last<T extends any[]> = T extends [...any[], infer L] ? L : never;
type Arrable<T> = T | T[];
type Overwriter<T> = Partial<T> | ((prev: T) => Partial<T>);

interface ChildrenMap {
  ActionRow: IComponentType[APIComponentInMessageActionRow["type"]];
  Container: IComponentType[APIComponentInContainer["type"]];
  Section: "TextDisplay";
}

type TraverserFn<C extends keyof CT, H extends (keyof CT)[], O extends string = ""> = <T extends C>(
  type: Arrable<T>,
) => Omit<Traverser<T, H, C>, O>;

type Component<T extends keyof CT> = Extract<
  APIMessageComponent,
  {
    type: CT[T extends "Button:URL" | "Button:SKU" ? "Button" : T];
  } & (T extends "Button"
    ? { custom_id: string }
    : T extends "Button:URL"
      ? { url: string }
      : T extends "Button:SKU"
        ? { sku_id: string }
        : object)
>;

export type Traverser<T extends keyof CT, H extends (keyof CT)[], ST extends keyof CT = keyof CT> = {
  /** Shallow merge with the current component in place. */
  update: (value: Overwriter<Component<T>>) => Traverser<T, H, ST>;
  /** The current component. */
  value: Component<T>;
  /** Access the parent of the current node. */
  parent: TraverserFn<keyof CT, [...H, T]>;
} & (T extends IComponentType[APISelectMenuComponent["type"]]
  ? object
  : {
      /** Insert a sibling before the current node. */
      insertBefore: <V extends Component<ST>>(component: V) => Traverser<T, H, ST>;
      /** Jump to the last neighbouring node of a type in an array. */
      last: <N extends ST>(type: Arrable<N>) => Traverser<N, [...H, T], ST> | undefined;
      /** Jump to the next neighbouring node of a type in an array. */
      next: <N extends ST>(type: Arrable<N>) => Traverser<N, [...H, T], ST> | undefined;
      /** Access the next node in an array. */
      sibling: TraverserFn<ST, [...H, T]>;
    }) &
  (T extends keyof ChildrenMap
    ? {
        /** Access the first child of a node. */
        child: TraverserFn<ChildrenMap[T], [...H, T]>;
      }
    : object) &
  (T extends "Section"
    ? {
        /** Access the accessory of a [Section](https://docs.discord.com/developers/components/reference#section). */
        accessory: TraverserFn<IComponentType[APISectionAccessoryComponent["type"]], [...H, T], "sibling">;
      }
    : object) &
  (H extends []
    ? object
    : {
        /** Return to the previous node. */
        previous: Traverser<Last<H>, Pop<H>>;
      });

const withChildren = new Set([ComponentType.ActionRow, ComponentType.Section, ComponentType.Container]);

const selects = new Set([
  ComponentType.StringSelect,
  ComponentType.UserSelect,
  ComponentType.RoleSelect,
  ComponentType.MentionableSelect,
  ComponentType.ChannelSelect,
]);

function typesMatch(component: APIMessageComponent, expected: string | string[], throwOnMismatch?: boolean) {
  const expectedTypes = new Set((Array.isArray(expected) ? expected : [expected]).filter(Boolean));
  if (!expectedTypes.size) {
    throw new Error("Selectors must specify expected type(s)");
  }
  let actualType = ComponentType[component.type];
  if (actualType === "Button") {
    if ("url" in component) actualType += ":URL";
    else if ("sku_id" in component) actualType += ":SKU";
  } else if (actualType === "SelectMenu") actualType = "StringSelect";
  if (!expectedTypes.has(actualType)) {
    if (throwOnMismatch) {
      throw new TypeError(`Type mismatch: expected ${[...expectedTypes].join(" or ")}, got ${actualType}`);
    }
    return false;
  }
  return true;
}

function find(query: number | string | RegExp, components: APIMessageComponent[]): APIMessageComponent | undefined {
  for (const component of components) {
    if (
      (typeof query === "number" && component.id === query) ||
      ("custom_id" in component &&
        ((typeof query === "string" && component.custom_id === query) ||
          (query instanceof RegExp && query.test(component.custom_id))))
    ) {
      return component;
    }
    if ("components" in component) {
      const found = find(query, component.components);
      if (found) return found;
    }
    if (component.type === ComponentType.Section && component.accessory) {
      const found = find(query, [component.accessory]);
      if (found) return found;
    }
  }
}

function findParent(child: APIMessageComponent, components: APIMessageComponent[]): APIMessageComponent | undefined {
  for (const component of components) {
    if ("components" in component) {
      if ((component.components as APIMessageComponent[]).includes(child)) return component;
      const found = findParent(child, component.components);
      if (found) return found;
    }
    if (component.type === ComponentType.Section && component.accessory === child) {
      return component;
    }
  }
}

/** Initiate a tree traverser. */
export default function abseil<T extends APIMessageComponent>(components: T[]) {
  function createTraverser<C extends APIMessageComponent>(
    component: C,
    expected: string | string[],
    previous?: Traverser<keyof CT, (keyof CT)[]>,
    neighbours?: APIMessageComponent[],
  ): Traverser<IComponentType[C["type"]], []> {
    typesMatch(component, expected, true);
    const traverser: any = {
      value: component,
      update(v: Overwriter<APIMessageComponent>) {
        Object.assign(component, typeof v === "function" ? v(component) : v);
        return traverser;
      },
      parent(t: string) {
        const parentComponent = findParent(component, components);
        if (!parentComponent) throw new Error("This node does not have a parent");
        const parentParent = findParent(parentComponent, components);
        return createTraverser(
          parentComponent,
          t,
          traverser,
          parentParent && "components" in parentParent ? parentParent.components : [],
        );
      },
    };
    if (previous) traverser.previous = previous;
    if (neighbours) {
      if (!selects.has(component.type)) {
        traverser.insertBefore = (v: APIMessageComponent) => {
          neighbours.splice(neighbours.indexOf(component), 0, v);
          return traverser;
        };
        traverser.last = (t: string) => {
          for (let i = neighbours.length - 1; i >= 0; --i) {
            const sibling = neighbours[i];
            if (!typesMatch(sibling, t)) continue;
            return createTraverser(sibling, t, traverser, neighbours);
          }
        };
        traverser.next = (t: string) => {
          const next = neighbours.slice(neighbours.indexOf(component) + 1).find((s) => typesMatch(s, t));
          if (!next) return undefined;
          return createTraverser(next, t, traverser, neighbours);
        };
      }
      if (neighbours.length !== neighbours.indexOf(component) + 1) {
        traverser.sibling = (t: string) =>
          createTraverser(neighbours[neighbours.indexOf(component) + 1], t, traverser, neighbours);
      }
    }
    if (withChildren.has(component.type) && "components" in component) {
      traverser.child = (t: string) => createTraverser(component.components[0], t, traverser, component.components);
    }
    if (component.type === ComponentType.Section) {
      traverser.accessory = (t: string) => createTraverser(component.accessory, t, traverser);
    }
    return traverser;
  }
  return {
    /**
     * Enter the tree at a specific node.
     * @param query Either the component `id` or `custom_id`
     */
    find<Q extends number | string | RegExp, F extends Q extends number ? keyof CT : WithCustomIdType>(
      query: Q,
      type: Arrable<F>,
    ) {
      const component = find(query, components);
      if (!component || !typesMatch(component, type)) return undefined;
      const parent = findParent(component, components);
      return createTraverser(
        component,
        type,
        undefined,
        parent && "components" in parent ? parent.components : components,
      ) as Omit<Traverser<F, []>, "previous">;
    },
    /** Entry point of the tree, visually this is the top-leftmost component. */
    initial: ((t) => createTraverser(components[0], t, undefined, components)) as TraverserFn<
      IComponentType[T["type"]],
      [],
      "parent" | "previous"
    >,
  };
}

/**
 * Destroy a node in the tree.
 * Data on this node will be stripped, attempting to access most functions will throw.
 * @important This may cause issues when you try to navigate {@link abseil} instances you've previously created
 */
export function removeNode<T extends keyof CT>(node: Traverser<T, any, any>) {
  const { components } = node.parent(["ActionRow", "Container", "Section"]).value;
  components?.splice(components.indexOf(node.value as never), 1);
  for (const key of Object.keys(node)) {
    if (key === "previous" || key === "last") continue;
    node[key as keyof typeof node] = (
      key === "value"
        ? null
        : () => {
            throw new RangeError(`Unable to access ${key} on node as it was removed`);
          }
    ) as never;
  }
}

export const assert = <T extends keyof CT>(
  component: APIMessageComponent,
  type: Arrable<T>,
): component is Component<T> => typesMatch(component, type);
