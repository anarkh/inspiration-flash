import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
export async function chooseOne(title, choices) {
    const enabled = choices.filter((choice) => !choice.disabled);
    if (enabled.length === 0) {
        throw new Error(`No available choices for ${title}`);
    }
    if (!process.stdin.isTTY) {
        return enabled[0].value;
    }
    const rl = createInterface({ input, output });
    try {
        for (;;) {
            output.write(`\n${title}\n`);
            choices.forEach((choice, index) => {
                const disabled = choice.disabled ? " [unavailable]" : "";
                const description = choice.description ? ` - ${choice.description}` : "";
                output.write(`  ${index + 1}. ${choice.label}${disabled}${description}\n`);
            });
            const answer = await rl.question(`Select 1-${choices.length}: `);
            const selected = Number.parseInt(answer.trim(), 10);
            if (Number.isInteger(selected) && selected >= 1 && selected <= choices.length) {
                const choice = choices[selected - 1];
                if (!choice.disabled) {
                    return choice.value;
                }
            }
            output.write("Please select an available option.\n");
        }
    }
    finally {
        rl.close();
    }
}
export async function chooseMany(title, choices) {
    const enabled = choices.filter((choice) => !choice.disabled);
    if (enabled.length === 0) {
        throw new Error(`No available choices for ${title}`);
    }
    if (!process.stdin.isTTY) {
        return [enabled[0].value];
    }
    const rl = createInterface({ input, output });
    try {
        for (;;) {
            output.write(`\n${title}\n`);
            choices.forEach((choice, index) => {
                const disabled = choice.disabled ? " [unavailable]" : "";
                const description = choice.description ? ` - ${choice.description}` : "";
                output.write(`  ${index + 1}. ${choice.label}${disabled}${description}\n`);
            });
            const answer = await rl.question("Select one or more numbers, comma separated: ");
            const indexes = answer
                .split(",")
                .map((item) => Number.parseInt(item.trim(), 10))
                .filter((item) => Number.isInteger(item));
            const selected = indexes
                .map((index) => choices[index - 1])
                .filter((choice) => Boolean(choice) && !choice.disabled);
            if (selected.length > 0) {
                return [...new Set(selected.map((choice) => choice.value))];
            }
            output.write("Please select at least one available option.\n");
        }
    }
    finally {
        rl.close();
    }
}
//# sourceMappingURL=interactive.js.map