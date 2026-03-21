/** biome-ignore-all lint/suspicious/noExplicitAny: Not worth my time */
import {
  type APIComponentInContainer,
  type APIComponentInMessageActionRow,
  type APIMessageComponent,
  type APISectionAccessoryComponent,
  type APISelectMenuComponent,
  ComponentType,
} from "discord-api-types/v10";

type CT = typeof ComponentType & {
  "Button:URL": ComponentType.Button;
  "Button:SKU": ComponentType.Button;
};
type IComponentType = { [K in keyof CT as CT[K]]: K };

type Pop<T extends any[]> = T extends [...infer Rest, any] ? Rest : never;
type Last<T extends any[]> = T extends [...any[], infer L] ? L : never;
type Arrable<T> = T | T[];
type Narr<T extends Arrable<string>> = T extends string ? T : T[number];
type Overwriter<T> = Partial<T> | ((prev: T) => Partial<T>);

interface ChildrenMap {
  ActionRow: IComponentType[APIComponentInMessageActionRow["type"]] | "Button:URL" | "Button:SKU";
  Container: IComponentType[APIComponentInContainer["type"]];
  Section: "TextDisplay";
}

type TraverserFn<C extends keyof CT, H extends (keyof CT)[], O extends string = ""> = <const T extends Arrable<C>>(
  type: T,
) => Omit<Traverser<Narr<T>, H, C>, O>;

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

type Traverser<T extends keyof CT, H extends (keyof CT)[], ST extends keyof CT = keyof CT> = {
  /** Shallow merge with the current component in place */
  update: (value: Overwriter<Component<T>>) => Traverser<T, H, ST>;
  /** The current component */
  value: Component<T>;
} & (T extends IComponentType[APISelectMenuComponent["type"]]
  ? object
  : {
      /** Insert a sibling before the current node */
      insertBefore: (
        component: Extract<
          APIMessageComponent,
          { type: (typeof ComponentType)[Exclude<ST, "Button:URL" | "Button:SKU">] }
        >,
      ) => Traverser<T, H, ST>;
      /** Jump to the last neighbouring node of a type in an array */
      last: <const N extends Arrable<ST>>(type: N) => Traverser<Narr<N>, [...H, T], ST> | undefined;
      /** Jump to the next neighbouring node of a type in an array */
      next: <const N extends Arrable<ST>>(type: N) => Traverser<Narr<N>, [...H, T], ST> | undefined;
      /** Access the next node in an array */
      sibling: TraverserFn<ST, [...H, T]>;
    }) &
  (T extends keyof ChildrenMap
    ? {
        /** Access the first child of a node */
        child: TraverserFn<ChildrenMap[T], [...H, T]>;
      }
    : object) &
  (T extends "Section"
    ? {
        /** Access the accessory of a [Section](https://docs.discord.com/developers/components/reference#section) */
        accessory: TraverserFn<IComponentType[APISectionAccessoryComponent["type"]], [...H, T], "sibling">;
      }
    : object) &
  (H extends []
    ? object
    : {
        /** Return to the previous node */
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

function matchTypes(component: APIMessageComponent, expected: string | string[], doNotThrow?: boolean) {
  const expectedTypes = new Set((Array.isArray(expected) ? expected : [expected]).filter(Boolean));
  if (!expectedTypes.size) {
    throw new Error("Selectors must specify expected type(s)");
  }
  let actualType = ComponentType[component.type];
  if (actualType === "Button") {
    if ("url" in component) actualType += ":URL";
    else if ("sku_id" in component) actualType += ":SKU";
  }
  if (!expectedTypes.has(actualType)) {
    if (!doNotThrow) {
      throw new TypeError(`Type mismatch: expected ${[...expectedTypes].join(" or ")}, got ${actualType}`);
    }
    return false;
  }
  return true;
}

function createTraverser<C extends APIMessageComponent>(
  component: C,
  expected: string | string[],
  previous?: Traverser<keyof CT, (keyof CT)[]>,
  neighbours?: APIMessageComponent[],
): Traverser<IComponentType[C["type"]], []> {
  matchTypes(component, expected);
  const traverser: any = {
    value: component,
    update(v: Overwriter<APIMessageComponent>) {
      Object.assign(component, typeof v === "function" ? v(component) : v);
      return traverser;
    },
  };
  if (previous) traverser.previous = previous;
  if (neighbours) {
    if (!selects.has(component.type)) {
      traverser.insertBefore = (v: APIMessageComponent) => {
        neighbours.splice(neighbours.indexOf(component as never), 0, v as never);
        return traverser;
      };
      traverser.last = (t: string) => {
        for (let i = neighbours.length - 1; i >= 0; --i) {
          const sibling = neighbours[i];
          if (!matchTypes(sibling, t, true)) continue;
          return createTraverser(sibling, t, traverser, neighbours);
        }
        return undefined;
      };
      traverser.next = (t: string) => {
        const next = neighbours.slice(neighbours.indexOf(component) + 1).find((s) => matchTypes(s, t, true));
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

/** Initiate a tree traverser */
const abseil = <T extends APIMessageComponent>(components: T[]) => ({
  initial: ((t) => createTraverser(components[0], t, undefined, components)) as TraverserFn<
    IComponentType[T["type"]],
    [],
    "previous"
  >,
});

export default abseil;
