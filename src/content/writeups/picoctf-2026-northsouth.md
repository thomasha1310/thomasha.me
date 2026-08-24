---
title: "picoCTF 2026: North-South"
date: 2026
description: "using tor to force international packet routing"
---

## Tools Used

- Tor (on Kali Linux)

## Methodology

We are given the link to a web service, but it doesn't seem to be very helpful. However, we _are_ given the full Nginx config file for the server. Upon inspection, we find these lines:

```nginx
if ($geoip2_data_country_code = IS) {
    proxy_pass http://south;
}
```

Using [Wikipedia](https://en.wikipedia.org/wiki/List_of_ISO_3166_country_codes), we find that the country code `IS` corresponds to Iceland.
This gives us a solve path: trick the server into thinking we're in Iceland.

The easiest way to do this is with a Tor proxy, which routes internet traffic through a series of relays before reaching an exit node.
The server will only see the IP address of the exit node, so we can use Tor (configured to use an Icelandic exit node) to essentially spoof our geographic location.
First, we install Tor:

```
sudo apt update
sudo apt install tor
```

Then, open the configuration file:

```
sudo nano /etc/tor/torrc
```

And append the configurations we need:

```
ExitNodes {is}
StrictNodes 1
```

Finally, we restart the service:

```
sudo systemctl restart tor
```

By default, Tor uses a SOCKS5 proxy on port 9050, so we need to send the traffic through this port:

```
curl -x socks5h://127.0.0.1:9050 http://lonely-island.picoctf.net:50539/ | grep -oE "picoCTF\{.*\}"
```

We use `socks5h` to force DNS resolution through the Tor network, which prevents DNS leaks.

Immediately, we get the flag: `picoCTF{g30_b453d_r0u71n9_********}`.
