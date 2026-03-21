import { describe, expect, test } from "bun:test";
import {
  type APIActionRowComponent,
  type APIButtonComponent,
  type APIButtonComponentWithCustomId,
  type APIContainerComponent,
  type APISectionComponent,
  type APITextDisplayComponent,
  type APIThumbnailComponent,
  type APIUserSelectComponent,
  ButtonStyle,
  ComponentType,
} from "discord-api-types/v10";
import abseil from "./index.ts";

const message = {
  components: [
    { type: ComponentType.TextDisplay } as APITextDisplayComponent,
    {
      type: ComponentType.Container,
      components: [
        {
          type: ComponentType.Section,
          accessory: { type: ComponentType.Thumbnail } as APIThumbnailComponent,
          components: [
            { type: ComponentType.TextDisplay } as APITextDisplayComponent,
            { type: ComponentType.TextDisplay } as APITextDisplayComponent,
          ],
        } satisfies APISectionComponent,
        { type: ComponentType.Separator },
        {
          type: ComponentType.ActionRow,
          components: [{ type: ComponentType.UserSelect } as APIUserSelectComponent],
        } satisfies APIActionRowComponent<APIUserSelectComponent>,
      ],
      accent_color: 0 as number,
      spoiler: false as boolean,
    } satisfies APIContainerComponent,
    {
      type: ComponentType.ActionRow,
      components: [
        { type: ComponentType.Button, custom_id: "b1" } as APIButtonComponentWithCustomId,
        { type: ComponentType.Button, custom_id: "b2" } as APIButtonComponentWithCustomId,
      ],
    } satisfies APIActionRowComponent<APIButtonComponentWithCustomId>,
  ] as const,
};

describe("abseil traverser", () => {
  test("should traverse initial component", () => {
    const t = abseil(message.components).initial("TextDisplay");
    expect(t.value.type).toBe(ComponentType.TextDisplay);
  });

  test("should traverse sibling component", () => {
    const t = abseil(message.components).initial("TextDisplay").sibling("Container");
    expect(t.value.type).toBe(ComponentType.Container);
  });

  test("should traverse child component", () => {
    const t = abseil(message.components).initial("TextDisplay").sibling("Container").child("Section");
    expect(t.value.type).toBe(ComponentType.Section);
  });

  test("should traverse accessory component", () => {
    const t = abseil(message.components)
      .initial("TextDisplay")
      .sibling("Container")
      .child("Section")
      .accessory("Thumbnail");
    expect(t.value.type).toBe(ComponentType.Thumbnail);
  });

  test("should return to previous component", () => {
    const t = abseil(message.components).initial("TextDisplay").sibling("Container");
    expect(t.previous?.value.type).toBe(ComponentType.TextDisplay);
  });

  test("should update component properties in-place", () => {
    const traverser = abseil(message.components).initial("TextDisplay").sibling("Container").update({ spoiler: true });

    expect(message.components[1].spoiler).toBe(true);
    expect(traverser.value.spoiler).toBe(true);
  });

  test("should update component using a function in-place", () => {
    const traverser = abseil(message.components)
      .initial("TextDisplay")
      .sibling("Container")
      .update((prev) => ({ ...prev, accent_color: 42 }));

    expect(message.components[1].accent_color).toBe(42);
    expect(traverser.value.accent_color).toBe(42);
  });

  test("should handle URL button type correctly", () => {
    const urlButton = {
      type: ComponentType.Button,
      url: "https://example.com",
      style: ButtonStyle.Link,
    } satisfies APIButtonComponent;
    const t = abseil([urlButton]).initial("Button:URL");
    expect(t.value.url).toBe("https://example.com");
  });

  test("should handle SKU button type correctly", () => {
    const skuButton = {
      type: ComponentType.Button,
      sku_id: "sku-123",
      style: ButtonStyle.Premium,
    } satisfies APIButtonComponent;
    const t = abseil([skuButton]).initial("Button:SKU");
    expect(t.value.sku_id).toBe("sku-123");
  });

  test("should throw when initial type does not match", () => {
    const btn = {
      type: ComponentType.Button,
      custom_id: "b1",
      style: ButtonStyle.Primary,
    } satisfies APIButtonComponent;
    expect(() => abseil([btn]).initial("Button:URL")).toThrow(TypeError);
  });

  test("should traverse sibling components sequentially", () => {
    const traverser = abseil(message.components).initial("TextDisplay").sibling("Container").sibling("ActionRow");

    expect(traverser.value.type).toBe(ComponentType.ActionRow);
    expect(traverser.previous?.value.type).toBe(ComponentType.Container);
  });

  test("should allow adding new components via update", () => {
    const t = abseil(message.components)
      .initial("TextDisplay")
      .sibling("Container")
      .sibling("ActionRow")
      .update((prev) => ({
        components: prev.components.concat({
          type: ComponentType.Button,
          custom_id: "new",
          style: ButtonStyle.Primary,
        }),
      }));
    expect(message.components[2].components.length).toBe(3);
    expect((t.value.components[2] as APIButtonComponentWithCustomId).custom_id).toBe("new");
  });

  test("do not include child function if not a parent type", () => {
    const t = abseil([{ type: ComponentType.TextDisplay, content: "" }]);
    expect(t.initial("TextDisplay")).not.toHaveProperty("child");
  });

  test("do not include sibling function if no siblings", () => {
    const t = abseil([{ type: ComponentType.TextDisplay, content: "" }]);
    expect(t.initial("TextDisplay")).not.toHaveProperty("sibling");
  });
});
