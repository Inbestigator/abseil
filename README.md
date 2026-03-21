# Abseil

Quickly traverse Discord [Components V2](https://docs.discord.com/developers/components/overview) trees.

## Reference

| function     | description                                                                                           |
| ------------ | ----------------------------------------------------------------------------------------------------- |
| accessory    | Access the accessory of a [Section](https://docs.discord.com/developers/components/reference#section) |
| child        | Access the first child of a node                                                                      |
| insertBefore | Insert a sibling before the current node                                                              |
| last         | Jump to the last neighbouring node of a type in an array                                              |
| next         | Jump to the next neighbouring node of a type in an array                                              |
| previous     | Return to the previous node                                                                           |
| sibling      | Access the next node in an array                                                                      |
| update       | Shallow merge with the current component in place                                                     |
| value        | The current component                                                                                 |

## Example

<details>
<summary>Sample message definition</summary>

```ts
import type { APIMessage } from "discord-api-types/v10";
import { ActionRow, Button, Container, Section, Separator, TextDisplay } from "dressed";

const message = {
  components: [
    Container(
      Section(["## Trivia!"], Button({ custom_id: "suggest", style: "Secondary" })),
      TextDisplay("What is the meaning of life?"),
      ActionRow(
        Button({ custom_id: "money", label: "💵" }),
        Button({ custom_id: "42", label: "🤖" }),
      ),
      Separator(),
      Section(["## 🟩🟩🟥🟥🟥⬛⬛⬛⬛⬛"], Button({ custom_id: "stats", style: "Secondary" })),
    ),
  ],
} as APIMessage;
```

</details>

```ts
import abseil from "abseil";
import { editMessage } from "dressed";

const section = abseil(message.components ?? [])
  .initial("Container")
  .child("Section");

let button = section.next("ActionRow")?.child("Button");

while (button) {
  button.update({ disabled: true });
  // The last item in an array does not have a sibling function
  button = button.sibling?.("Button");
}

// Insert-if-not-exists the warning message
if (section.last("TextDisplay")?.sibling) {
  section.previous.update((prev) => ({
    components: prev.components.concat(TextDisplay("-# This has expired!")),
  }));
}

editMessage("<CHANNEL_ID>", "<MESSAGE_ID>", { components: message.components });
```
