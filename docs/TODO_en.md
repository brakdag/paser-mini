# XML tool not closed.

## What usually happens.

Sometimes the AI sends XML tags of tools, not closed, including the JSON also
not closed, this causes an error if it's placed in the history or in
the same message, so we need to check if there's an invalid message, that contains
an error, it shouldn't be recorded in the history, nor respond anything, it should be discarded, if
showing a notification perhaps in the chat, like error 502 etc, that doesn't
appear in the chat, if it appears to know that it happened but shouldn't be recorded
in the chat, because later everything breaks otherwise.

## XML not closed ERROR.

In this case, we should check if it's closed and close it, but it can also happen that the JSON is corrupted.

## THE JSON INSIDE THE XML IS CORRUPTED.

In this case, if the message can't be recovered, an error is emitted so the user can see it, and that's it. The function with an error shouldn't respond.

## Possible solutions.

Sanitize those corrupted calls, close the tag at the end of the message if it's not closed, and try to fix the JSON. Return an error in any case.