<%
const _locs  = zone.availableLocations;
const _names = new Set(_locs.map(l => l.name));
let _layout = 'C';
if      (_names.has('arm-side')) _layout = 'A';
else if (_names.has('up'))       _layout = 'B';
// anything else (glove-up etc.) is Zone C
%>

<% if (_layout === 'A') { %>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:4px;width:64px;">
        <div class="mz-cell mz-strike" style="height:30px;"></div>
        <div class="mz-cell mz-strike" style="height:30px;"></div>
    </div>

<% } else if (_layout === 'B') { %>
    <div style="display:grid;grid-template-columns:1fr;gap:4px;width:32px;">
        <div class="mz-cell mz-strike" style="height:30px;"></div>
        <div class="mz-cell mz-strike" style="height:30px;"></div>
    </div>

<% } else { %>
    <%# Zone C — 5x5 grid: chase border ring, 3x3 green strike core, mid-mid yellow %>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:3px;width:105px;">
        <div class="mz-cell mz-chase"  style="height:17px;"></div>
        <div class="mz-cell mz-chase"  style="height:17px;"></div>
        <div class="mz-cell mz-chase"  style="height:17px;"></div>
        <div class="mz-cell mz-chase"  style="height:17px;"></div>
        <div class="mz-cell mz-chase"  style="height:17px;"></div>

        <div class="mz-cell mz-chase"  style="height:17px;"></div>
        <div class="mz-cell mz-strike" style="height:17px;"></div>
        <div class="mz-cell mz-strike" style="height:17px;"></div>
        <div class="mz-cell mz-strike" style="height:17px;"></div>
        <div class="mz-cell mz-chase"  style="height:17px;"></div>

        <div class="mz-cell mz-chase"  style="height:17px;"></div>
        <div class="mz-cell mz-strike" style="height:17px;"></div>
        <div class="mz-cell mz-chase"  style="height:17px;"></div>
        <div class="mz-cell mz-strike" style="height:17px;"></div>
        <div class="mz-cell mz-chase"  style="height:17px;"></div>

        <div class="mz-cell mz-chase"  style="height:17px;"></div>
        <div class="mz-cell mz-strike" style="height:17px;"></div>
        <div class="mz-cell mz-strike" style="height:17px;"></div>
        <div class="mz-cell mz-strike" style="height:17px;"></div>
        <div class="mz-cell mz-chase"  style="height:17px;"></div>

        <div class="mz-cell mz-chase"  style="height:17px;"></div>
        <div class="mz-cell mz-chase"  style="height:17px;"></div>
        <div class="mz-cell mz-chase"  style="height:17px;"></div>
        <div class="mz-cell mz-chase"  style="height:17px;"></div>
        <div class="mz-cell mz-chase"  style="height:17px;"></div>
    </div>
<% } %>
