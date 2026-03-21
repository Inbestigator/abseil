# Abseil

Quickly traverse Discord [Components V2](https://docs.discord.com/developers/components/overview) trees. Either enter at the root with `abseil([...]).initial(type)` or jump to a specific node with `abseil([...]).find(query, type)`.

## Node Reference

| function     | description                                                                                           |
| ------------ | ----------------------------------------------------------------------------------------------------- |
| accessory    | Access the accessory of a [Section](https://docs.discord.com/developers/components/reference#section) |
| child        | Access the first child of a node                                                                      |
| insertBefore | Insert a sibling before the current node                                                              |
| last         | Jump to the last neighbouring node of a type in an array                                              |
| next         | Jump to the next neighbouring node of a type in an array                                              |
| parent       | Access the parent of a node                                                                           |
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
        Button({ custom_id: "guess-money", label: "💵" }),
        Button({ custom_id: "guess-42", label: "🤖" }),
      ),
      Separator(),
      Section(["## 🟩🟩🟥🟥🟥⬛⬛⬛⬛⬛"], Button({ custom_id: "stats-3-2", style: "Secondary" })),
    ),
  ],
} as APIMessage;
```

</details>

```ts
import abseil, { removeNode } from "abseil";
import { editMessage } from "dressed";

const line = abseil(message.components ?? []);

let guessBtn = line.find(/guess-.+/, "Button");

while (guessBtn) {
  guessBtn.update({ disabled: true });
  guessBtn = guessBtn.next("Button");
}

const header = line.initial("Container").child("Section");

header.insertBefore(TextDisplay(header.child("TextDisplay").value.content));
removeNode(header);

// Insert-if-not-exists the warning message
if (!header.last("Section")?.sibling) {
  header.previous.value.components.push(TextDisplay("-# This has expired!"));
}

editMessage("<CHANNEL_ID>", "<MESSAGE_ID>", { components: message.components });
```
