# Abseil

Quickly traverse Discord [Components V2](https://docs.discord.com/developers/components/overview) trees.

## Reference

| function  | description                                                                                           |
| --------- | ----------------------------------------------------------------------------------------------------- |
| accessory | Access the accessory of a [Section](https://docs.discord.com/developers/components/reference#section) |
| child     | Access the first child of a node                                                                      |
| previous  | Return to the previous node                                                                           |
| sibling   | Access the next node in an array                                                                      |
| update    | Shallow merge with the current component in place                                                     |
| value     | The current component                                                                                 |

## Example

```ts
import { type APIMessage, ComponentType } from "discord-api-types/v10";
import { Button, editMessage } from "dressed";
import abseil from "abseil";

const message = {
  components: [
    { type: ComponentType.TextDisplay },
    {
      type: ComponentType.Container,
      components: [
        {
          type: ComponentType.Section,
          accessory: { type: ComponentType.Thumbnail },
          components: [{ type: ComponentType.TextDisplay }, { type: ComponentType.TextDisplay }],
        },
        { type: ComponentType.Separator },
        { type: ComponentType.ActionRow, components: [{ type: ComponentType.UserSelect }] },
      ],
    },
    {
      type: ComponentType.ActionRow,
      components: [{ type: ComponentType.Button }, { type: ComponentType.Button }],
    },
  ],
} as APIMessage;

abseil(message.components ?? [])
  .initial("TextDisplay")
  .sibling("Container")
  .update({ spoiler: true })
  .sibling("ActionRow")
  .update((p) => ({
    components: p.components.concat(Button({ custom_id: "new", label: "I'm new!" })),
  }))
  .previous.child("Section")
  .accessory(["Button", "Thumbnail"])
  .update({ id: 32 });

editMessage("<CHANNEL_ID>", "<MESSAGE_ID>", message.components);
```
