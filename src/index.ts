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

function createTraverser<C extends APIMessageComponent>(
  component: C,
  expected: string | string[],
  previous?: Traverser<keyof CT, (keyof CT)[]>,
  siblings?: APIMessageComponent[],
): Traverser<IComponentType[C["type"]], []> {
  const expectedTypes = new Set(Array.isArray(expected) ? expected : [expected]);
  let actualType = ComponentType[component.type];
  if (actualType === "Button") {
    if ("url" in component) actualType += ":URL";
    else if ("sku_id" in component) actualType += ":SKU";
  }
  if (!expectedTypes.has(actualType)) {
    throw new TypeError(`Type mismatch: expected ${[...expectedTypes].join(" or ")}, got ${actualType}`);
  }
  const traverser: any = {
    value: component,
    update(v: Overwriter<APIMessageComponent>) {
      Object.assign(component, typeof v === "function" ? v(component) : v);
      return traverser;
    },
  };
  if (previous) traverser.previous = previous;
  if (siblings?.length) {
    traverser.sibling = (t: string) => createTraverser(siblings[0], t, traverser, siblings.slice(1));
  }
  if (withChildren.has(component.type) && "components" in component) {
    traverser.child = (t: string) =>
      createTraverser(component.components[0], t, traverser, component.components.slice(1));
  }
  if (component.type === ComponentType.Section) {
    traverser.accessory = (t: string) => createTraverser(component.accessory, t, traverser);
  }
  return traverser;
}

/** Initiate a tree traverser */
const abseil = <T extends APIMessageComponent>(components: readonly T[]) => ({
  initial: ((t) => createTraverser(components[0], t, undefined, components.slice(1))) as TraverserFn<
    IComponentType[T["type"]],
    [],
    "previous"
  >,
});

export default abseil;
